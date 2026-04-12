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

describe('Workflows API', () => {
  let manager;
  let projectId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['workflows-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'workflows-mgr@example.com', password: 'Password123!', firstName: 'WorkflowsMgr', lastName: 'User', role: 'manager'
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Workflow Test Proj' })
      .expect(201);
    projectId = createRes.body.data.id;
  });

  test('default workflow includes 4 states', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // workflow may be null if not yet set — that's fine, the service returns DEFAULT_WORKFLOW
    // Test via the board endpoint which uses the workflow
    const boardRes = await request(app)
      .get(`/api/projects/${projectId}/board`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(boardRes.body.data.length).toBe(4);
    const stateNames = boardRes.body.data.map((c) => c.state);
    expect(stateNames).toContain('To Do');
    expect(stateNames).toContain('In Progress');
    expect(stateNames).toContain('In Review');
    expect(stateNames).toContain('Done');
  });

  test('update workflow via PUT /api/projects/:id saves custom workflow', async () => {
    const customWorkflow = {
      states: [
        { name: 'Open', category: 'todo', transitions: ['Working'] },
        { name: 'Working', category: 'in_progress', transitions: ['Closed'] },
        { name: 'Closed', category: 'done', transitions: [] },
      ],
    };

    const updateRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ workflow: customWorkflow })
      .expect(200);

    expect(updateRes.body.data.workflow).toBeDefined();
    expect(updateRes.body.data.workflow.states.length).toBe(3);
    expect(updateRes.body.data.workflow.states[0].name).toBe('Open');
  });

  test('valid transition To Do → In Progress returns 200', async () => {
    // Use a workflow with state names matching internal status values
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

    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Workflow Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = issueRes.body.data.id;

    const transRes = await request(app)
      .post(`/api/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ targetState: 'in_progress' })
      .expect(200);

    expect(transRes.body.data.status).toBe('in_progress');
  });

  test('invalid transition returns 422', async () => {
    // Use a workflow with state names matching internal status values
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

    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Invalid Trans Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = issueRes.body.data.id;

    // Try to go from 'todo' directly to 'done' — not in transitions
    const res = await request(app)
      .post(`/api/issues/${issueId}/transition`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ targetState: 'done' })
      .expect(422);

    expect(res.body.success).toBe(false);
  });

  test('workflow state completeness — valid workflow with all categories is accepted', async () => {
    // Update workflow with valid states — should succeed
    const validWorkflow = {
      states: [
        { name: 'Backlog', category: 'todo', transitions: ['Active'] },
        { name: 'Active', category: 'in_progress', transitions: ['Done'] },
        { name: 'Done', category: 'done', transitions: [] },
      ],
    };

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ workflow: validWorkflow })
      .expect(200);

    expect(res.body.data.workflow.states.length).toBe(3);
    // All states have categories
    for (const state of res.body.data.workflow.states) {
      expect(['todo', 'in_progress', 'done']).toContain(state.category);
    }
  });

  test('unauthenticated workflow access returns 401', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
