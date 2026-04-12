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

const yesterday = new Date(Date.now() - 86400000).toISOString();
const nextWeek = new Date(Date.now() + 86400000 * 7).toISOString();

describe('Sprints API', () => {
  let manager;

  beforeAll(async () => {
    await cleanupUsersByEmails(['sprints-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'sprints-mgr@example.com', password: 'Password123!', firstName: 'SprintsMgr', lastName: 'User', role: 'manager'
    });
  });

  async function createProject() {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('sprints').deleteMany({});

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint Test Proj' })
      .expect(201);
    return res.body.data.id;
  }

  test('create sprint returns 201', async () => {
    const projectId = await createProject();

    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Sprint 1');
    expect(res.body.data.state).toBe('created');
  });

  test('start sprint returns 200 and state becomes active', async () => {
    const projectId = await createProject();

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);
    const sprintId = createRes.body.data.id;

    const startRes = await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(startRes.body.data.state).toBe('active');
  });

  test('close sprint returns 200 and state becomes closed', async () => {
    const projectId = await createProject();

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);
    const sprintId = createRes.body.data.id;

    await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    const closeRes = await request(app)
      .post(`/api/sprints/${sprintId}/close`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(closeRes.body.data.state).toBe('closed');
  });

  test('409 on double-start — starting second sprint when one is active', async () => {
    const projectId = await createProject();

    const s1 = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);

    await request(app)
      .post(`/api/sprints/${s1.body.data.id}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    const s2 = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 2', startDate: yesterday, endDate: nextWeek })
      .expect(201);

    const res = await request(app)
      .post(`/api/sprints/${s2.body.data.id}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(409);

    expect(res.body.success).toBe(false);
  });

  test('incomplete issues moved to backlog on sprint close', async () => {
    const projectId = await createProject();

    // Create sprint and start it
    const sprintRes = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);
    const sprintId = sprintRes.body.data.id;

    await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Create an issue and assign it to the sprint
    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Incomplete Issue', projectId, createdBy: manager.user.id, sprintId })
      .expect(201);
    const issueId = issueRes.body.data.id;

    // Close sprint without completing the issue
    await request(app)
      .post(`/api/sprints/${sprintId}/close`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Verify issue has no sprintId (moved to backlog)
    const issueAfter = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(issueAfter.body.data.sprintId).toBeFalsy();
  });

  test('sprint date validation — startDate >= endDate returns 400', async () => {
    const projectId = await createProject();

    const res = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Bad Sprint', startDate: nextWeek, endDate: yesterday })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  test('backlog returns issues with no sprintId', async () => {
    const projectId = await createProject();

    // Create an issue without a sprint
    await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Backlog Issue', projectId, createdBy: manager.user.id })
      .expect(201);

    const res = await request(app)
      .get(`/api/projects/${projectId}/backlog`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const issue of res.body.data) {
      expect(issue.sprintId).toBeFalsy();
    }
  });

  test('add issue to sprint via PUT /api/issues/:id with sprintId', async () => {
    const projectId = await createProject();

    const sprintRes = await request(app)
      .post(`/api/projects/${projectId}/sprints`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Sprint 1', startDate: yesterday, endDate: nextWeek })
      .expect(201);
    const sprintId = sprintRes.body.data.id;

    await request(app)
      .post(`/api/sprints/${sprintId}/start`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    // Create issue without sprint
    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Sprint Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    const issueId = issueRes.body.data.id;

    // Assign to sprint
    const updateRes = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ sprintId })
      .expect(200);

    expect(updateRes.body.data.sprintId).toBe(sprintId);
  });
});
