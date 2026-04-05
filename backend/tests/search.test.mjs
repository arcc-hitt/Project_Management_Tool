import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { cleanupUserByEmail, cleanupUsersByEmails, clearProjectDomainData } from './dbTestUtils.mjs';

async function registerAndLogin(user) {
  await cleanupUserByEmail(user.email);
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Search API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['mgr-search@example.com', 'dev-search@example.com']);
    manager = await registerAndLogin({ email: 'mgr-search@example.com', password: 'Password123!', firstName: 'MgrS', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-search@example.com', password: 'Password123!', firstName: 'DevS', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();

    const createProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Searchable Project', description: 'Find me' })
      .expect(201);
    projectId = createProj.body.data.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: dev.user.id, role: 'developer' })
      .expect(200);

    const createTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Searchable Task', description: 'Task to be found', projectId, assignedTo: dev.user.id })
      .expect(201);
    taskId = createTask.body.data.id;
  });

  test('unified search returns results for query', async () => {
    const res = await request(app)
      .get('/api/search')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('tasks');
  });

  test('project-only and task-only search endpoints work', async () => {
    const projRes = await request(app)
      .get('/api/search/projects')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(projRes.body.success).toBe(true);

    const taskRes = await request(app)
      .get('/api/search/tasks')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ query: 'Searchable' })
      .expect(200);
    expect(taskRes.body.success).toBe(true);
  });
});
