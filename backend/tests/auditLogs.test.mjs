import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.ts';
import database from '../src/config/database.ts';
import { cleanupUsersByEmails, clearProjectDomainData } from './dbTestUtils.mjs';

jest.setTimeout(30000);

async function registerAndLogin(user) {
  const reg = await request(app).post('/api/auth/register').send(user).expect(201);
  const token = reg.body.data.token;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, user: me.body.data };
}

async function clearAuditLogs() {
  const db = await database.connect();
  await db.collection('audit_logs').deleteMany({});
}

describe('Audit Logs API', () => {
  let admin;
  let manager;
  let developer;
  let projectId;

  const TEST_EMAILS = [
    'audit-admin@example.com',
    'audit-manager@example.com',
    'audit-dev@example.com',
  ];

  beforeAll(async () => {
    await cleanupUsersByEmails(TEST_EMAILS);

    admin = await registerAndLogin({
      email: 'audit-admin@example.com',
      password: 'Password123!',
      firstName: 'AuditAdmin',
      lastName: 'User',
      role: 'admin',
    });

    manager = await registerAndLogin({
      email: 'audit-manager@example.com',
      password: 'Password123!',
      firstName: 'AuditMgr',
      lastName: 'User',
      role: 'manager',
    });

    developer = await registerAndLogin({
      email: 'audit-dev@example.com',
      password: 'Password123!',
      firstName: 'AuditDev',
      lastName: 'User',
      role: 'developer',
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    await clearAuditLogs();

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Audit Test Project' })
      .expect(201);
    projectId = createRes.body.data.id;
  });

  afterAll(async () => {
    await clearAuditLogs();
    await cleanupUsersByEmails(TEST_EMAILS);
    await database.close();
  });

  // ── Req 11.4, 11.5 — access control ──────────────────────────────────────
  describe('GET /api/admin/audit-logs — access control', () => {
    test('returns 200 for admin users', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    test('returns 403 for manager (non-admin)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test('returns 403 for developer (non-admin)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${developer.token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test('returns 401 without authentication', async () => {
      await request(app).get('/api/admin/audit-logs').expect(401);
    });
  });

  // ── Req 11.1 — log creation for auditable actions ─────────────────────────
  describe('Audit log creation for auditable actions', () => {
    test('logs project.settings_updated when project is updated', async () => {
      await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ name: 'Updated Project Name' })
        .expect(200);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'project.settings_updated' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'project.settings_updated');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('project');
      expect(entry.entityId).toBe(projectId);
      expect(entry.actorUserId).toBeDefined();
    });

    test('logs project.member_added when a member is added to a project', async () => {
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ userId: developer.user.id, role: 'developer' })
        .expect(200);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'project.member_added' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'project.member_added');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('project');
      expect(entry.entityId).toBe(projectId);
      expect(entry.newValues).toMatchObject({ userId: developer.user.id });
    });

    test('logs project.member_removed when a member is removed from a project', async () => {
      // First add the developer
      await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ userId: developer.user.id, role: 'developer' })
        .expect(200);

      await clearAuditLogs();

      // Now remove them
      await request(app)
        .delete(`/api/projects/${projectId}/members/${developer.user.id}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'project.member_removed' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'project.member_removed');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('project');
      expect(entry.entityId).toBe(projectId);
    });

    test('logs sprint.started when a sprint is started', async () => {
      const sprintRes = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ name: 'Sprint 1' })
        .expect(201);

      const sprintId = sprintRes.body.data.id;

      await request(app)
        .post(`/api/sprints/${sprintId}/start`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      // Audit log is written asynchronously — allow a brief moment for it to persist
      await new Promise((r) => setTimeout(r, 200));

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'sprint.started' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'sprint.started');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('sprint');
      expect(entry.entityId).toBe(sprintId);
      expect(entry.oldValues).toMatchObject({ state: 'created' });
      expect(entry.newValues).toMatchObject({ state: 'active' });
    });

    test('logs sprint.closed when a sprint is closed', async () => {
      const sprintRes = await request(app)
        .post(`/api/projects/${projectId}/sprints`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ name: 'Sprint Close Test' })
        .expect(201);

      const sprintId = sprintRes.body.data.id;

      await request(app)
        .post(`/api/sprints/${sprintId}/start`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      await request(app)
        .post(`/api/sprints/${sprintId}/close`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      // Audit log is written asynchronously — allow a brief moment for it to persist
      await new Promise((r) => setTimeout(r, 200));

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'sprint.closed' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'sprint.closed');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('sprint');
      expect(entry.entityId).toBe(sprintId);
      expect(entry.newValues).toMatchObject({ state: 'closed' });
    });

    test('logs webhook.registered when a webhook is created', async () => {
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'https://example.com/audit-hook',
          events: ['issue.created'],
        })
        .expect(201);

      // Audit log is written asynchronously — allow a brief moment for it to persist
      await new Promise((r) => setTimeout(r, 200));

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'webhook.registered' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'webhook.registered');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('webhook');
    });

    test('logs webhook.deleted when a webhook is deleted', async () => {
      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'https://example.com/audit-hook-del',
          events: ['issue.created'],
        })
        .expect(201);

      const webhookId = createRes.body.data.id;
      await clearAuditLogs();

      await request(app)
        .delete(`/api/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(204);

      // Audit log is written asynchronously — allow a brief moment for it to persist
      await new Promise((r) => setTimeout(r, 200));

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'webhook.deleted' })
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      const entry = logs.find((l) => l.action === 'webhook.deleted');
      expect(entry).toBeDefined();
      expect(entry.entityType).toBe('webhook');
      expect(entry.entityId).toBe(webhookId);
    });
  });

  // ── Req 11.2 — entry fields ───────────────────────────────────────────────
  describe('Audit log entry fields (Req 11.2)', () => {
    test('each entry contains all required fields', async () => {
      await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ name: 'Field Check Project' })
        .expect(200);

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      const logs = res.body.data.logs;
      expect(logs.length).toBeGreaterThanOrEqual(1);

      for (const entry of logs) {
        expect(entry.actorUserId).toBeDefined();
        expect(entry.action).toBeDefined();
        expect(entry.entityType).toBeDefined();
        expect(entry.entityId).toBeDefined();
        expect(entry.ipAddress).toBeDefined();
        expect(entry.userAgent).toBeDefined();
        expect(entry.createdAt).toBeDefined();
        // oldValues and newValues may be null but must be present
        expect('oldValues' in entry).toBe(true);
        expect('newValues' in entry).toBe(true);
      }
    });
  });

  // ── Req 11.3 — append-only (no update/delete endpoints) ──────────────────
  describe('Append-only invariant (Req 11.3)', () => {
    test('PUT /api/admin/audit-logs/:id does not exist (404, 405, or 500)', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .put(`/api/admin/audit-logs/${fakeId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ action: 'tampered' });

      expect([404, 405, 500]).toContain(res.status);
    });

    test('DELETE /api/admin/audit-logs/:id does not exist (404, 405, or 500)', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .delete(`/api/admin/audit-logs/${fakeId}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect([404, 405, 500]).toContain(res.status);
    });
  });

  // ── Req 11.4 — pagination and filtering ──────────────────────────────────
  describe('Pagination and filtering (Req 11.4)', () => {
    beforeEach(async () => {
      // Generate several audit log entries via project updates
      for (let i = 0; i < 5; i++) {
        await request(app)
          .put(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${manager.token}`)
          .send({ name: `Project Update ${i}` })
          .expect(200);
      }
    });

    test('returns paginated results with total and page metadata', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(res.body.success).toBe(true);
      const { logs, total, page, limit, totalPages } = res.body.data;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeLessThanOrEqual(2);
      expect(total).toBeGreaterThanOrEqual(5);
      expect(page).toBe(1);
      expect(limit).toBe(2);
      expect(totalPages).toBeGreaterThanOrEqual(3);
    });

    test('filters by action', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'project.settings_updated' })
        .expect(200);

      const { logs } = res.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      for (const entry of logs) {
        expect(entry.action).toBe('project.settings_updated');
      }
    });

    test('filters by entityType', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ entityType: 'project' })
        .expect(200);

      const { logs } = res.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      for (const entry of logs) {
        expect(entry.entityType).toBe('project');
      }
    });

    test('filters by actorUserId', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ actorUserId: manager.user.id })
        .expect(200);

      const { logs } = res.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      for (const entry of logs) {
        expect(entry.actorUserId).toBe(manager.user.id);
      }
    });

    test('filters by date range', async () => {
      const dateFrom = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
      const dateTo = new Date(Date.now() + 60_000).toISOString();   // 1 minute from now

      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ dateFrom, dateTo })
        .expect(200);

      const { logs } = res.body.data;
      expect(logs.length).toBeGreaterThanOrEqual(1);
      for (const entry of logs) {
        const ts = new Date(entry.createdAt).getTime();
        expect(ts).toBeGreaterThanOrEqual(new Date(dateFrom).getTime());
        expect(ts).toBeLessThanOrEqual(new Date(dateTo).getTime());
      }
    });

    test('returns empty array when no logs match filters', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ action: 'nonexistent.action' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    test('second page returns different entries than first page', async () => {
      const page1 = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      const page2 = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${admin.token}`)
        .query({ page: 2, limit: 2 })
        .expect(200);

      const ids1 = page1.body.data.logs.map((l) => l.id);
      const ids2 = page2.body.data.logs.map((l) => l.id);

      // No overlap between pages
      const overlap = ids1.filter((id) => ids2.includes(id));
      expect(overlap.length).toBe(0);
    });
  });
});
