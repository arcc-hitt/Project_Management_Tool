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
    await database.query('DELETE FROM task_comments WHERE user_id = ?', [uid]);
    await database.query('DELETE FROM users WHERE id = ?', [uid]);
  }
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

describe('Comments API', () => {
  let manager, dev, projectId, taskId;

  beforeAll(async () => {
    for (const email of ['mgr-comments@example.com', 'dev-comments@example.com']) {
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
    manager = await registerAndLogin({ email: 'mgr-comments@example.com', password: 'Password123!', firstName: 'MgrC', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-comments@example.com', password: 'Password123!', firstName: 'DevC', lastName: 'User', role: 'developer' });
  });

  beforeEach(async () => {
    await database.query('DELETE FROM project_members');
    await database.query('DELETE FROM task_comments');
    await database.query('DELETE FROM tasks');
    await database.query('DELETE FROM projects');

    const createProj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Comments Proj' })
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
      .send({ title: 'Commentable Task', projectId, assignedTo: dev.user.id })
      .expect(201);
    taskId = createTask.body.data.id;
  });

  test('developer can create, list, update and delete comments via /api/comments', async () => {
    // create comment
    const createComment = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ taskId, comment: 'Initial comment' })
      .expect(201);
    expect(createComment.body.success).toBe(true);
    const commentId = createComment.body.data.comment.id;

    // fetch by task
    const listRes = await request(app)
      .get(`/api/comments/task/${taskId}`)
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(200);
    expect(Array.isArray(listRes.body.data.comments)).toBe(true);
    expect(listRes.body.data.comments.length).toBeGreaterThanOrEqual(1);

    // get by id
    const getRes = await request(app)
      .get(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(200);
    expect(getRes.body.data.comment.id).toBe(commentId);

    // update
    const updateRes = await request(app)
      .put(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ comment: 'Updated comment' })
      .expect(200);
    expect(updateRes.body.data.comment.comment).toBe('Updated comment');

    // delete
    await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(200);
  });
});
