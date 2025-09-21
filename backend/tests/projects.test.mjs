import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import database from '../src/config/database.js';

// Helper to register and login a user, returning token and user
async function registerAndLogin(user) {
  // Clean dependent rows then user to avoid FK issues when re-running
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

describe('Projects API', () => {
  let admin, manager, dev;

  beforeAll(async () => {
    // ensure clean users & dependent rows in safe order
    const emails = ['admin@example.com', 'manager@example.com', 'dev@example.com'];
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

    // create users with roles
    admin = await registerAndLogin({
      email: 'admin@example.com', password: 'Password123!', firstName: 'Admin', lastName: 'User', role: 'admin'
    });
    manager = await registerAndLogin({
      email: 'manager@example.com', password: 'Password123!', firstName: 'Mgr', lastName: 'User', role: 'manager'
    });
    dev = await registerAndLogin({
      email: 'dev@example.com', password: 'Password123!', firstName: 'Dev', lastName: 'User', role: 'developer'
    });
  });

  beforeEach(async () => {
    // Cleanup projects and related tables between tests (respect FKs)
    await database.query('DELETE FROM project_members');
    await database.query('DELETE FROM tasks');
    await database.query('DELETE FROM projects');
  });

  test('admin can create, update, and delete a project', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Proj A', description: 'Test project' })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    const projectId = createRes.body.data.id;

    // Get by id
    const getRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(getRes.body.data.name).toBe('Proj A');

    // Update
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'active', priority: 'high' })
      .expect(200);
    expect(updateRes.body.data.status).toBe('active');

    // Delete
    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    // Ensure gone
    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);
  });

  test('manager can create a project and add/manage/remove team members', async () => {
    // Create as manager
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Team Proj', description: 'With team' })
      .expect(201);
    const projectId = createRes.body.data.id;

    // Add developer as member
    const addMemberRes = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: dev.user.id, role: 'developer' })
      .expect(200);
    expect(addMemberRes.body.success).toBe(true);

    // Update member role
    const updateRoleRes = await request(app)
      .put(`/api/projects/${projectId}/members/${dev.user.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ role: 'tester' })
      .expect(200);
    expect(updateRoleRes.body.success).toBe(true);

    // Remove member
    const removeRes = await request(app)
      .delete(`/api/projects/${projectId}/members/${dev.user.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(removeRes.body.success).toBe(true);
  });

  test('developer cannot create a project but can list own projects', async () => {
    // Attempt to create
    const forbidden = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ name: 'Dev Proj' })
      .expect(403);
    expect(forbidden.body.success).toBe(false);

    // Manager creates and adds dev as member
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Dev Team Proj' })
      .expect(201);
    const projectId = createRes.body.data.id;

    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ userId: dev.user.id, role: 'developer' })
      .expect(200);

    // Dev lists own projects
    const myRes = await request(app)
      .get('/api/projects/my')
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(200);
    expect(Array.isArray(myRes.body.data.projects)).toBe(true);
    expect(myRes.body.data.projects.length).toBeGreaterThanOrEqual(1);
  });
});
