import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
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

/** Build a minimal Response-like object for mocking fetch */
function makeFetchResponse(status, body = 'ok') {
  return {
    status,
    text: async () => body,
  };
}

describe('Webhooks API', () => {
  let manager;
  let projectId;

  beforeAll(async () => {
    await cleanupUsersByEmails(['webhook-mgr@example.com']);
    manager = await registerAndLogin({
      email: 'webhook-mgr@example.com',
      password: 'Password123!',
      firstName: 'WebhookMgr',
      lastName: 'User',
      role: 'manager',
    });
  });

  beforeEach(async () => {
    await clearProjectDomainData();
    const db = await database.connect();
    await db.collection('webhooks').deleteMany({});
    await db.collection('webhook_deliveries').deleteMany({});

    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Webhook Test Project' })
      .expect(201);
    projectId = createRes.body.data.id;
  });

  afterAll(async () => {
    await cleanupUsersByEmails(['webhook-mgr@example.com']);
    const db = await database.connect();
    await db.collection('webhooks').deleteMany({});
    await db.collection('webhook_deliveries').deleteMany({});
    await database.close();
  });

  // ── Req 10.1 / 10.6 ──────────────────────────────────────────────────────
  describe('POST /api/webhooks — registration', () => {
    test('registers a webhook with a valid HTTPS URL', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'https://example.com/hook',
          events: ['issue.created'],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        projectId,
        url: 'https://example.com/hook',
        events: ['issue.created'],
      });
      expect(res.body.data.id).toBeDefined();
    });

    test('registers a webhook with an optional secret', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'https://example.com/hook',
          events: ['issue.updated'],
          secret: 'my-secret',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      // Secret must NOT be returned in the response (security)
      expect(res.body.data.secret).toBeUndefined();
    });

    // ── Req 10.6 ─────────────────────────────────────────────────────────────
    test('returns 400 for a non-HTTPS URL (http://)', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'http://example.com/hook',
          events: ['issue.created'],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/https/i);
    });

    test('returns 400 for an invalid URL', async () => {
      const res = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({
          projectId,
          url: 'not-a-url',
          events: ['issue.created'],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    test('returns 401 without authentication', async () => {
      await request(app)
        .post('/api/webhooks')
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(401);
    });
  });

  // ── Req 10.6 — list ───────────────────────────────────────────────────────
  describe('GET /api/webhooks — list', () => {
    test('returns webhooks for the project', async () => {
      // Register two webhooks
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook1', events: ['issue.created'] })
        .expect(201);

      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook2', events: ['sprint.started'] })
        .expect(201);

      const res = await request(app)
        .get(`/api/webhooks?projectId=${projectId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      const urls = res.body.data.map((w) => w.url);
      expect(urls).toContain('https://example.com/hook1');
      expect(urls).toContain('https://example.com/hook2');
    });

    test('returns 400 when projectId is missing', async () => {
      const res = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Req 10.6 — delete ─────────────────────────────────────────────────────
  describe('DELETE /api/webhooks/:id — delete', () => {
    test('removes a webhook', async () => {
      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      const webhookId = createRes.body.data.id;

      await request(app)
        .delete(`/api/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(204);

      // Confirm it's gone from the list
      const listRes = await request(app)
        .get(`/api/webhooks?projectId=${projectId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(200);

      const ids = listRes.body.data.map((w) => w.id);
      expect(ids).not.toContain(webhookId);
    });

    test('returns 404 for a non-existent webhook', async () => {
      const fakeId = '000000000000000000000001';
      const res = await request(app)
        .delete(`/api/webhooks/${fakeId}`)
        .set('Authorization', `Bearer ${manager.token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ── Req 10.3 — delivery ───────────────────────────────────────────────────
  describe('Webhook delivery', () => {
    test('sends HTTP POST with correct payload fields on event dispatch', async () => {
      // Register webhook
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      let capturedBody;
      let capturedHeaders;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        capturedHeaders = opts.headers;
        return makeFetchResponse(200, 'delivered');
      });

      try {
        // Import and call dispatchEvent directly
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        await webhookService.dispatchEvent('issue.created', projectId, { issue: { id: 'iss-1', title: 'Test' } });
      } finally {
        fetchSpy.mockRestore();
      }

      expect(capturedBody).toBeDefined();
      expect(capturedBody.event).toBe('issue.created');
      expect(capturedBody.timestamp).toBeDefined();
      expect(capturedBody.projectId).toBe(projectId);
      expect(capturedBody.issue).toMatchObject({ id: 'iss-1', title: 'Test' });
      expect(capturedHeaders['Content-Type']).toBe('application/json');
    });

    // ── Req 10.5 — HMAC signature ─────────────────────────────────────────
    test('includes X-Kiro-Signature header when secret is configured', async () => {
      const secret = 'super-secret';

      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'], secret })
        .expect(201);

      let capturedHeaders;
      let capturedRawBody;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
        capturedRawBody = opts.body;
        capturedHeaders = opts.headers;
        return makeFetchResponse(200, 'ok');
      });

      try {
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        await webhookService.dispatchEvent('issue.created', projectId, { issue: { id: 'iss-2' } });
      } finally {
        fetchSpy.mockRestore();
      }

      expect(capturedHeaders['X-Kiro-Signature']).toBeDefined();

      // Verify the HMAC is correct
      const expectedSig = crypto.createHmac('sha256', secret).update(capturedRawBody).digest('hex');
      expect(capturedHeaders['X-Kiro-Signature']).toBe(expectedSig);
    });

    test('does NOT include X-Kiro-Signature when no secret is configured', async () => {
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      let capturedHeaders;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
        capturedHeaders = opts.headers;
        return makeFetchResponse(200, 'ok');
      });

      try {
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        await webhookService.dispatchEvent('issue.created', projectId, {});
      } finally {
        fetchSpy.mockRestore();
      }

      expect(capturedHeaders['X-Kiro-Signature']).toBeUndefined();
    });

    // ── Req 10.4 — retry logic ────────────────────────────────────────────
    test('retries up to 3 times on non-2xx response', async () => {
      await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      let callCount = 0;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return makeFetchResponse(500, 'server error');
      });

      try {
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        // Override sleep to avoid waiting in tests
        await webhookService._deliverWithRetry(
          { id: 'test', url: 'https://example.com/hook', secret: null },
          'issue.created',
          JSON.stringify({ event: 'issue.created', timestamp: new Date().toISOString(), projectId })
        );
      } finally {
        fetchSpy.mockRestore();
      }

      // 1 initial attempt + 3 retries = 4 total calls
      expect(callCount).toBe(4);
    }, 20000);

    // ── Req 10.7 — delivery log ───────────────────────────────────────────
    test('creates a WebhookDelivery log entry after successful delivery', async () => {
      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      const webhookId = createRes.body.data.id;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return makeFetchResponse(200, 'delivered');
      });

      try {
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        await webhookService.dispatchEvent('issue.created', projectId, { issue: { id: 'iss-3' } });
      } finally {
        fetchSpy.mockRestore();
      }

      // Check delivery log in DB
      const db = await database.connect();
      const deliveries = await db.collection('webhook_deliveries').find({ webhookId }).toArray();

      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      const delivery = deliveries[0];
      expect(delivery.webhookId).toBe(webhookId);
      expect(delivery.event).toBe('issue.created');
      expect(delivery.statusCode).toBe(200);
      expect(delivery.responseBody).toBe('delivered');
      expect(delivery.attemptCount).toBeGreaterThanOrEqual(1);
      expect(delivery.deliveredAt).toBeDefined();
    });

    test('creates a WebhookDelivery log entry after failed delivery (all retries exhausted)', async () => {
      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ projectId, url: 'https://example.com/hook', events: ['issue.created'] })
        .expect(201);

      const webhookId = createRes.body.data.id;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return makeFetchResponse(503, 'unavailable');
      });

      try {
        const { default: webhookService } = await import('../src/services/webhookService.ts');
        await webhookService.dispatchEvent('issue.created', projectId, {});
      } finally {
        fetchSpy.mockRestore();
      }

      const db = await database.connect();
      const deliveries = await db.collection('webhook_deliveries').find({ webhookId }).toArray();

      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      const delivery = deliveries[0];
      expect(delivery.webhookId).toBe(webhookId);
      expect(delivery.event).toBe('issue.created');
      expect(delivery.statusCode).toBe(503);
      expect(delivery.attemptCount).toBe(4); // 1 initial + 3 retries
      expect(delivery.deliveredAt).toBeNull();
    }, 20000);
  });
});
