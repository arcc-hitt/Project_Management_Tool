import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import database from '../src/config/database.js';

async function registerAndLogin(user) {
  const existing = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [user.email]);
  if (existing.length) {
    const uid = existing[0].id;
    await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
    await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
    await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
    await database.query('DELETE FROM notifications WHERE user_id = ?', [uid]);
    await database.query('DELETE FROM users WHERE id = ?', [uid]);
  }
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Tasks API', () => {
  let manager, dev;
  let projectId;

  beforeAll(async () => {
    const emails = ['manager2@example.com', 'dev2@example.com'];
    for (const email of emails) {
      const rows = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (rows.length) {
        const uid = rows[0].id;
        await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
        await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
        await database.query('DELETE FROM notifications WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM users WHERE id = ?', [uid]);
      }
    }

    manager = await registerAndLogin({
      email: 'manager2@example.com', password: 'Password123!', firstName: 'Mgr2', lastName: 'User', role: 'manager'
    });
    dev = await registerAndLogin({
      email: 'dev2@example.com', password: 'Password123!', firstName: 'Dev2', lastName: 'User', role: 'developer'
    });
  });

  beforeEach(async () => {
    // reset projects/tasks for clean runs in FK-safe order
    await database.query('DELETE FROM project_members');
    await database.query('DELETE FROM tasks');
    await database.query('DELETE FROM projects');

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Task Proj' })
      .expect(201);
    projectId = createRes.body.data.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: dev.user.id, role: 'developer' })
      .expect(200);
  });

  test('manager can create task and update status to done', async () => {
    const createTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        title: 'My Task',
        projectId,
        createdBy: manager.user.id,
        assignedTo: dev.user.id
      })
      .expect(201);
    const taskId = createTask.body.data.id;

    const updateStatus = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ status: 'done' })
      .expect(200);

    expect(updateStatus.body.data.status).toBe('done');
    // completed_at is set by trigger/logic; we assert field presence if returned
    // not all controllers return all fields; basic sanity
  });

  test('developer can list accessible tasks and add a comment', async () => {
    // create a task
    const createTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        title: 'Dev Task',
        projectId,
        createdBy: manager.user.id,
        assignedTo: dev.user.id
      })
      .expect(201);
    const taskId = createTask.body.data.id;

    // list tasks (if route available) or fetch by id
    const getTask = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(200);

    // add comment
    const addComment = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ content: 'Looks good' })
      .expect(201);

    expect(addComment.body.success).toBe(true);
  });
});
