import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
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

describe('Attachments API', () => {
  let manager, outsider;
  let projectId, issueId;

  beforeAll(async () => {
    await cleanupUsersByEmails([
      'attach-mgr@example.com',
      'attach-outsider@example.com',
    ]);
    manager = await registerAndLogin({
      email: 'attach-mgr@example.com',
      password: 'Password123!',
      firstName: 'AttachMgr',
      lastName: 'User',
      role: 'manager',
    });
    outsider = await registerAndLogin({
      email: 'attach-outsider@example.com',
      password: 'Password123!',
      firstName: 'Outsider',
      lastName: 'User',
      role: 'developer',
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('issues').deleteMany({});
    await db.collection('attachments').deleteMany({});

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Attach Test Proj' })
      .expect(201);
    projectId = projRes.body.data.id;

    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ title: 'Attach Issue', projectId, createdBy: manager.user.id })
      .expect(201);
    issueId = issueRes.body.data.id;
  });

  // Requirements 9.1 — upload stores all required fields
  test('upload creates attachment record with all required fields', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('hello world'), { filename: 'hello.txt', contentType: 'text/plain' })
      .expect(201);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.issueId).toBe(issueId);
    expect(data.uploadedBy).toBe(manager.user.id);
    expect(data.originalName).toBe('hello.txt');
    expect(data.mimeType).toBe('text/plain');
    expect(data.sizeBytes).toBeGreaterThan(0);
    expect(data.storagePath).toBeTruthy();
    expect(data.createdAt).toBeTruthy();
  });

  // Requirements 9.2, 9.3 — 413 on oversized file
  test('returns 413 when file exceeds 25 MB', async () => {
    const oversized = Buffer.alloc(26 * 1024 * 1024, 'x'); // 26 MB
    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', oversized, { filename: 'big.bin', contentType: 'application/octet-stream' })
      .expect(413);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/25 MB/i);
  });

  // Requirements 9.7 — 403 for non-member on download
  test('returns 403 when non-member tries to download attachment', async () => {
    // Upload as manager first
    const uploadRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('secret'), { filename: 'secret.txt', contentType: 'text/plain' })
      .expect(201);
    const attachmentId = uploadRes.body.data.id;

    // Outsider (not a project member) tries to download
    const res = await request(app)
      .get(`/api/issues/${issueId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // Requirements 9.7 — 403 for non-member on delete
  test('returns 403 when non-member tries to delete attachment', async () => {
    const uploadRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('data'), { filename: 'data.txt', contentType: 'text/plain' })
      .expect(201);
    const attachmentId = uploadRes.body.data.id;

    const res = await request(app)
      .delete(`/api/issues/${issueId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  // Requirements 9.4 — download returns correct Content-Type and Content-Disposition headers
  test('download returns correct Content-Type and Content-Disposition headers', async () => {
    const content = 'attachment content';
    const uploadRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from(content), { filename: 'report.txt', contentType: 'text/plain' })
      .expect(201);
    const attachmentId = uploadRes.body.data.id;

    const res = await request(app)
      .get(`/api/issues/${issueId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/report\.txt/);
  });

  // Requirements 9.5 — delete removes record and file
  test('delete removes attachment record and subsequent download returns 404', async () => {
    const uploadRes = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('to delete'), { filename: 'todelete.txt', contentType: 'text/plain' })
      .expect(201);
    const attachmentId = uploadRes.body.data.id;

    // Delete
    await request(app)
      .delete(`/api/issues/${issueId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(204);

    // Subsequent download should 404
    await request(app)
      .get(`/api/issues/${issueId}/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${manager.token}`)
      .expect(404);
  });

  // Requirements 9.6 — allowed MIME types accepted
  test('accepts image MIME type upload', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('fake-png'), { filename: 'screenshot.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.data.mimeType).toBe('image/png');
  });

  test('accepts PDF upload', async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set('Authorization', `Bearer ${manager.token}`)
      .attach('file', Buffer.from('%PDF-fake'), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(res.body.data.mimeType).toBe('application/pdf');
  });

  // Unauthenticated request
  test('returns 401 for unauthenticated upload', async () => {
    await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .attach('file', Buffer.from('data'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(401);
  });
});
