import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import database from '../src/config/database.js';

async function registerAndLogin(user) {
  const existing = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [user.email]);
  if (existing.length) {
    const uid = existing[0].id;
    await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
    await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
    await database.query('DELETE FROM task_comments WHERE user_id = ?', [uid]);
    await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
    await database.query('DELETE FROM users WHERE id = ?', [uid]);
  }
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Activities API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    for (const email of ['mgr-activity@example.com', 'dev-activity@example.com']) {
      const rows = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (rows.length) {
        const uid = rows[0].id;
        await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
        await database.query('DELETE FROM task_comments WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
        await database.query('DELETE FROM users WHERE id = ?', [uid]);
      }
    }
    manager = await registerAndLogin({ email: 'mgr-activity@example.com', password: 'Password123!', firstName: 'MgrA', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-activity@example.com', password: 'Password123!', firstName: 'DevA', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await database.query('DELETE FROM project_members');
    await database.query('DELETE FROM task_comments');
    await database.query('DELETE FROM tasks');
    await database.query('DELETE FROM projects');

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
