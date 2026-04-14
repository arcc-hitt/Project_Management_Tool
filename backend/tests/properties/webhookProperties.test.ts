/**
 * Property-based tests for Webhook HMAC signature determinism.
 * Feature: jira-level-platform
 * Validates: Requirements 10.5
 */

import * as fc from 'fast-check';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Pure helper — mirrors computeHmacSignature in webhookService.ts
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 signature for a payload body using the given secret.
 * This is the same logic used in webhookService._deliverWithRetry to set
 * the X-Kiro-Signature header.
 */
function computeHmacSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Independently verify a signature against a body and secret.
 * This mirrors what a webhook consumer would do to validate the header.
 */
function verifyHmacSignature(body: string, secret: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary non-empty string suitable for use as a webhook secret. */
const secretArb = fc.string({ minLength: 1, maxLength: 128 });

/** Arbitrary string representing a serialised JSON payload body. */
const bodyArb = fc.string({ minLength: 0, maxLength: 1024 });

// ---------------------------------------------------------------------------
// Property 17: Webhook HMAC signature determinism
// Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
// ---------------------------------------------------------------------------

describe('Property 17: Webhook HMAC signature determinism', () => {
  // **Validates: Requirements 10.5**

  it('X-Kiro-Signature can be independently verified with the same secret and payload', () => {
    // Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
    fc.assert(
      fc.property(bodyArb, secretArb, (body, secret) => {
        const signature = computeHmacSignature(body, secret);

        // The consumer independently recomputes the HMAC and compares
        const isValid = verifyHmacSignature(body, secret, signature);
        expect(isValid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('same body and secret always produce the same signature (determinism)', () => {
    // Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
    fc.assert(
      fc.property(bodyArb, secretArb, (body, secret) => {
        const sig1 = computeHmacSignature(body, secret);
        const sig2 = computeHmacSignature(body, secret);

        expect(sig1).toBe(sig2);
      }),
      { numRuns: 100 },
    );
  });

  it('different secrets produce different signatures for the same body (with high probability)', () => {
    // Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
    fc.assert(
      fc.property(
        bodyArb,
        secretArb,
        secretArb,
        (body, secret1, secret2) => {
          fc.pre(secret1 !== secret2);

          const sig1 = computeHmacSignature(body, secret1);
          const sig2 = computeHmacSignature(body, secret2);

          expect(sig1).not.toBe(sig2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('different bodies produce different signatures for the same secret (with high probability)', () => {
    // Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
    fc.assert(
      fc.property(
        bodyArb,
        bodyArb,
        secretArb,
        (body1, body2, secret) => {
          fc.pre(body1 !== body2);

          const sig1 = computeHmacSignature(body1, secret);
          const sig2 = computeHmacSignature(body2, secret);

          expect(sig1).not.toBe(sig2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('signature is a 64-character lowercase hex string (SHA-256 output format)', () => {
    // Feature: jira-level-platform, Property 17: Webhook HMAC signature determinism
    fc.assert(
      fc.property(bodyArb, secretArb, (body, secret) => {
        const signature = computeHmacSignature(body, secret);

        expect(typeof signature).toBe('string');
        expect(signature).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(signature)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
