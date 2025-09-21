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
    await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
    await database.query('DELETE FROM users WHERE id = ?', [uid]);
  }
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Search API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    for (const email of ['mgr-search@example.com', 'dev-search@example.com']) {
      const rows = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (rows.length) {
        const uid = rows[0].id;
        await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
        await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
        await database.query('DELETE FROM users WHERE id = ?', [uid]);
      }
    }
    manager = await registerAndLogin({ email: 'mgr-search@example.com', password: 'Password123!', firstName: 'MgrS', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-search@example.com', password: 'Password123!', firstName: 'DevS', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await database.query('DELETE FROM project_members');
    await database.query('DELETE FROM tasks');
    await database.query('DELETE FROM projects');

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
