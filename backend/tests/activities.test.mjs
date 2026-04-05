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

describe('Activities API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['mgr-activity@example.com', 'dev-activity@example.com']);
    manager = await registerAndLogin({ email: 'mgr-activity@example.com', password: 'Password123!', firstName: 'MgrA', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-activity@example.com', password: 'Password123!', firstName: 'DevA', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await clearProjectDomainData();

    const createProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Activity Proj' })
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
      .send({ title: 'Activity Task', projectId, assignedTo: dev.user.id })
      .expect(201);
    taskId = createTask.body.data.id;
  });

  test('listing activities returns results after a comment', async () => {
    // create a comment to generate activity
    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ taskId, comment: 'Activity trigger comment' })
      .expect(201);

    const list = await request(app)
      .get('/api/activities')
      .set('Authorization', `Bearer ${dev.token}`)
      .query({ limit: 10 })
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(list.body.data).toHaveProperty('activities');
    expect(Array.isArray(list.body.data.activities)).toBe(true);
  });
});
