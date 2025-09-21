import { describe, test, expect, beforeAll } from '@jest/globals';
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

describe('Dashboard API', () => {
  let manager, dev;

  beforeAll(async () => {
    for (const email of ['mgr-dashboard@example.com', 'dev-dashboard@example.com']) {
      const rows = await database.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (rows.length) {
        const uid = rows[0].id;
        await database.query('DELETE FROM project_members WHERE user_id = ?', [uid]);
        await database.query('DELETE FROM tasks WHERE created_by = ? OR assigned_to = ?', [uid, uid]);
        await database.query('DELETE FROM projects WHERE created_by = ?', [uid]);
        await database.query('DELETE FROM users WHERE id = ?', [uid]);
      }
    }
    manager = await registerAndLogin({ email: 'mgr-dashboard@example.com', password: 'Password123!', firstName: 'MgrD', lastName: 'User', role: 'manager' });
    dev = await registerAndLogin({ email: 'dev-dashboard@example.com', password: 'Password123!', firstName: 'DevD', lastName: 'User', role: 'developer' });
  });

  test('manager can get dashboard overview', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('overview');
  });

  test('developer cannot access team performance; manager can', async () => {
    // developer forbidden
    const devRes = await request(app)
      .get('/api/dashboard/team')
      .set('Authorization', `Bearer ${dev.token}`)
      .expect(403);
    expect(devRes.body.success).toBe(false);

    // manager allowed
    const mgrRes = await request(app)
      .get('/api/dashboard/team')
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);
    expect(mgrRes.body.success).toBe(true);
  });
});
