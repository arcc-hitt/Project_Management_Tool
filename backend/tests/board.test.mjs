import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.ts';
import database from '../src/config/database.ts';
import { cleanupUsersByEmails, clearProjectDomainData } from './dbTestUtils.mjs';

// Increase timeout for DB reconnection between test files
jest.setTimeout(30000);

async function registerAndLogin(user) {
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Board API', () => {
  let manager;
  let projectId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['board-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'board-mgr@example.com', password: 'Password123!', firstName: 'BoardMgr', lastName: 'User', role: 'manager'
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Board Test Proj' })
      .expect(201);
    projectId = createRes.body.data.id;
  });

  test('board columns are returned grouped by workflow state', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/board`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Each column has a state and issues array
    for (const col of res.body.data) {
      expect(typeof col.state).toBe('string');
      expect(Array.isArray(col.issues)).toBe(true);
    }
  });

  test('reorder issues within a column returns 200', async () => {
    // Create 2 issues in todo state
    const i1 = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Issue A', projectId, createdBy: manager.user.id })
      .expect(201);
    const i2 = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Issue B', projectId, createdBy: manager.user.id })
      .expect(201);

    const id1 = i1.body.data.id;
    const id2 = i2.body.data.id;

    // Reorder in reverse
    const res = await request(app)
      .put('/api/issues/reorder')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ columnState: 'todo', orderedIssueIds: [id2, id1] })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  test('transition issue to valid next state updates status', async () => {
    // Set up a workflow with state names matching internal status values
    const workflow = {
      states: [
        { name: 'todo', category: 'todo', transitions: ['in_progress'] },
        { name: 'in_progress', category: 'in_progress', transitions: ['done'] },
        { name: 'done', category: 'done', transitions: [] },
      ],
    };
    await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ workflow })
      .expect(200);

    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Transition Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = createRes.body.data.id;

    // Default status is 'todo', transition to 'in_progress'
    const transRes = await request(app)
      .post(`/api/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ targetState: 'in_progress' })
      .expect(200);

    expect(transRes.body.data.status).toBe('in_progress');
  });

  test('transition to invalid state returns 422', async () => {
    // Set up a workflow with state names matching internal status values
    const workflow = {
      states: [
        { name: 'todo', category: 'todo', transitions: ['in_progress'] },
        { name: 'in_progress', category: 'in_progress', transitions: ['done'] },
        { name: 'done', category: 'done', transitions: [] },
      ],
    };
    await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ workflow })
      .expect(200);

    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Invalid Transition Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = createRes.body.data.id;

    // Try to go from 'todo' directly to 'done' — not in transitions
    const res = await request(app)
      .post(`/api/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ targetState: 'done' })
      .expect(422);

    expect(res.body.success).toBe(false);
  });

  test('unauthenticated board access returns 401', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/board`)
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
