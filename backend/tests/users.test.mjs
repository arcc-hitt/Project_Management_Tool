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

describe('Users API', () => {
  let admin;

  beforeAll(async () => {
    // ensure clean admin
    const email = 'admin-users@example.com';
    const rows = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length) {
      const uid = rows[0].id;
      await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
      await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
      await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
      await database.query('DELETE FROM notifications WHERE user_id = ?', [uid]);
      await database.query('DELETE FROM users WHERE id = ?', [uid]);
    }
    admin = await registerAndLogin({
      email: email, password: 'Password123!', firstName: 'Admin', lastName: 'Users', role: 'admin'
    });
  });

  beforeEach(async () => {
    // cleanup non-admin test users possibly created by prior tests
    await database.query("DELETE FROM users WHERE email LIKE 'test-user-%@example.com%'");
  });

  test('admin can create, list, get, update, update role, deactivate and reactivate a user', async () => {
    // Create user via admin endpoint
    const newUserPayload = {
      email: 'test-user-1@example.com',
      password: 'Password123!',
      firstName: 'Testy',
      lastName: 'McUser',
      role: 'developer'
    };

    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(newUserPayload)
      .expect(201);
    expect(createRes.body.success).toBe(true);
    const createdUserId = createRes.body.data.id || createRes.body.data.user?.id || createRes.body.data?.userId || createRes.body.data?.user?.userId;

    // List users
    const listRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(Array.isArray(listRes.body.data.users)).toBe(true);
    expect(listRes.body.data.users.find(u => u.email === newUserPayload.email)).toBeTruthy();

    // Get user by id
    const getRes = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(getRes.body.data.email).toBe(newUserPayload.email);

    // Update user
    const updateRes = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ firstName: 'Updated' })
      .expect(200);
    expect(updateRes.body.data.firstName).toBe('Updated');

    // Update role
    const roleRes = await request(app)
      .put(`/api/users/${createdUserId}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'manager' })
      .expect(200);
    expect(roleRes.body.data.role).toBe('manager');

    // Deactivate (delete)
    await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    // Reactivate
    const reactivateRes = await request(app)
      .post(`/api/users/${createdUserId}/reactivate`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(reactivateRes.body.data.isActive).toBe(true);
  });
});
