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

describe('Issues API', () => {
  let manager;
  let projectId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['issues-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'issues-mgr@example.com', password: 'Password123!', firstName: 'IssuesMgr', lastName: 'User', role: 'manager'
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Issue Test Proj' })
      .expect(201);
    projectId = createRes.body.data.id;
  });

  test('creates issue with default issueType task', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Default Task', projectId, createdBy: manager.user.id })
      .expect(201);

    expect(res.body.data.issueType).toBe('task');
  });

  test('creates bug issue with default bugSeverity medium', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'A Bug', projectId, createdBy: manager.user.id, issueType: 'bug' })
      .expect(201);

    expect(res.body.data.issueType).toBe('bug');
    expect(res.body.data.bugSeverity).toBe('medium');
  });

  test('creates bug with explicit bugSeverity critical', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Critical Bug', projectId, createdBy: manager.user.id, issueType: 'bug', bugSeverity: 'critical' })
      .expect(201);

    expect(res.body.data.bugSeverity).toBe('critical');
  });

  test('creates epic with childIssueIds stored', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'An Epic', projectId, createdBy: manager.user.id, issueType: 'epic', childIssueIds: ['abc123'] })
      .expect(201);

    expect(res.body.data.issueType).toBe('epic');
    expect(res.body.data.childIssueIds).toContain('abc123');
  });

  test('creates task with storyPoints stored', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Pointed Task', projectId, createdBy: manager.user.id, storyPoints: 5 })
      .expect(201);

    expect(res.body.data.storyPoints).toBe(5);
  });

  test('invalid issueType returns 400', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Bad Type', projectId, createdBy: manager.user.id, issueType: 'invalid' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  test('issueKey is generated in format {KEY}-{N}', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Key Test', projectId, createdBy: manager.user.id })
      .expect(201);

    expect(res.body.data.issueKey).toMatch(/^[A-Z0-9]+-\d+$/);
  });

  test('CRUD: create, get, update, delete issue', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'CRUD Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = createRes.body.data.id;

    // Get
    const getRes = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(getRes.body.data.title).toBe('CRUD Issue');

    // Update
    const updateRes = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Updated Issue' })
      .expect(200);
    expect(updateRes.body.data.title).toBe('Updated Issue');

    // Delete
    await request(app)
      .delete(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Confirm gone
    await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(404);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ title: 'No Auth Issue', projectId, createdBy: 'someone' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
