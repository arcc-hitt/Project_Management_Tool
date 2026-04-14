import crypto from 'crypto';
import Webhook from '../models/Webhook.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import ProjectMember from '../models/ProjectMember.js';
import auditLogService from './auditLogService.js';
import AuditLog from '../models/AuditLog.js';

export const SUPPORTED_EVENTS = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.transitioned',
  'comment.created',
  'sprint.started',
  'sprint.closed',
  'attachment.uploaded',
] as const;

export type WebhookEvent = (typeof SUPPORTED_EVENTS)[number];

const DELIVERY_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

const createError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const isValidHttpsUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const computeHmacSignature = (body: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempt a single HTTP POST delivery to a webhook URL.
 * Returns { statusCode, responseBody } or throws on network/timeout error.
 */
const attemptDelivery = async (
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<{ statusCode: number; responseBody: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: controller.signal,
    });

    const responseBody = await response.text().catch(() => '');
    return { statusCode: response.status, responseBody };
  } finally {
    clearTimeout(timer);
  }
};

const webhookService = {
  /**
   * Register a new webhook. Validates HTTPS URL and that events are supported.
   * Req 10.1, 10.6
   */
  async registerWebhook(data: any, userId: string, req?: any): Promise<Webhook> {
    if (!isValidHttpsUrl(data.url)) {
      throw createError('Webhook URL must be a valid HTTPS URL', 400);
    }

    if (!Array.isArray(data.events) || data.events.length === 0) {
      throw createError('At least one event must be specified', 400);
    }

    const invalidEvents = data.events.filter(
      (e: string) => !(SUPPORTED_EVENTS as readonly string[]).includes(e)
    );
    if (invalidEvents.length > 0) {
      throw createError(`Unsupported events: ${invalidEvents.join(', ')}`, 400);
    }

    const webhook = await Webhook.create({
      organizationId: data.organizationId || null,
      projectId: data.projectId,
      url: data.url,
      events: data.events,
      secret: data.secret || null,
      createdBy: userId,
    });

    // Audit log: webhook registered (Req 11.1)
    auditLogService.log(
      userId,
      AuditLog.ACTIONS.WEBHOOK_REGISTERED,
      AuditLog.ENTITY_TYPES.WEBHOOK,
      webhook.id,
      null,
      { url: data.url, events: data.events, projectId: data.projectId },
      req
    ).catch((err) => console.error('auditLog error (webhook.registered):', err));

    return webhook;
  },

  /**
   * Dispatch an event to all matching webhooks for a project.
   * Retries up to 3× with exponential backoff on failure.
   * Logs each attempt to WebhookDelivery.
   * Req 10.2, 10.3, 10.4, 10.5, 10.7
   */
  async dispatchEvent(
    event: WebhookEvent,
    projectId: string,
    payload: Record<string, any>
  ): Promise<void> {
    let webhooks: Webhook[];
    try {
      webhooks = await Webhook.findMatchingEvent(projectId, event);
    } catch (err) {
      console.error(`webhookService.dispatchEvent: failed to load webhooks for ${event}:`, err);
      return;
    }

    if (webhooks.length === 0) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      projectId,
      ...payload,
    });

    await Promise.all(
      webhooks.map((webhook) => webhookService._deliverWithRetry(webhook, event, body))
    );
  },

  /**
   * Internal: deliver to a single webhook with retry logic.
   */
  async _deliverWithRetry(webhook: Webhook, event: string, body: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (webhook.secret) {
      headers['X-Kiro-Signature'] = computeHmacSignature(body, webhook.secret);
    }

    let lastStatusCode: number | null = null;
    let lastResponseBody = '';
    let attemptCount = 0;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      attemptCount = attempt + 1;
      try {
        const { statusCode, responseBody } = await attemptDelivery(webhook.url, body, headers);
        lastStatusCode = statusCode;
        lastResponseBody = responseBody;

        if (statusCode >= 200 && statusCode < 300) {
          // Success — log and stop
          await WebhookDelivery.create({
            webhookId: webhook.id,
            event,
            statusCode,
            responseBody,
            attemptCount,
            deliveredAt: new Date(),
          }).catch((err) => console.error('Failed to log webhook delivery:', err));
          return;
        }

        // Non-2xx — retry if attempts remain
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      } catch (err: any) {
        // Network error or timeout
        lastResponseBody = err.message || 'Network error';
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    // All attempts exhausted — log final failure
    await WebhookDelivery.create({
      webhookId: webhook.id,
      event,
      statusCode: lastStatusCode,
      responseBody: lastResponseBody,
      attemptCount,
      deliveredAt: null,
    }).catch((err) => console.error('Failed to log webhook delivery failure:', err));
  },

  /**
   * List webhooks for a project. Req 10.6
   */
  async listWebhooks(projectId: string, userId: string): Promise<Webhook[]> {
    // Verify user is a project member
    const member = await ProjectMember.findOne({ projectId, userId });
    if (!member) {
      throw createError('Access denied: not a member of this project', 403);
    }
    return Webhook.findByProject(projectId);
  },

  /**
   * Delete a webhook. Req 10.6
   */
  async deleteWebhook(webhookId: string, userId: string, req?: any): Promise<void> {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook) {
      throw createError('Webhook not found', 404);
    }

    // Verify user is a project member
    const member = await ProjectMember.findOne({ projectId: webhook.projectId, userId });
    if (!member) {
      throw createError('Access denied: not a member of this project', 403);
    }

    await Webhook.delete(webhookId);

    // Audit log: webhook deleted (Req 11.1)
    auditLogService.log(
      userId,
      AuditLog.ACTIONS.WEBHOOK_DELETED,
      AuditLog.ENTITY_TYPES.WEBHOOK,
      webhookId,
      { url: webhook.url, events: webhook.events, projectId: webhook.projectId },
      null,
      req
    ).catch((err) => console.error('auditLog error (webhook.deleted):', err));
  },
};

export default webhookService;
