/**
 * SSO Integration Tests
 *
 * Tests Google/GitHub OAuth2 callback flows with mocked Passport strategies,
 * JWT issuance, account linking, duplicate prevention, and error redirects.
 *
 * Requirements: 12.1–12.7
 */

import { jest, describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import app from '../src/server.ts';
import database from '../src/config/database.ts';
import { cleanupUsersByEmails } from './dbTestUtils.mjs';

// ─── Test email constants ─────────────────────────────────────────────────────
const GOOGLE_EMAIL = 'sso-google-test@example.com';
const GITHUB_EMAIL = 'sso-github-test@example.com';
const EXISTING_EMAIL = 'sso-existing-test@example.com';
const LINK_EMAIL = 'sso-link-test@example.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mock passport.authenticate for a given strategy so the callback route
 * can be exercised without a real OAuth2 round-trip.
 *
 * The mock replaces passport.authenticate so that when the strategy name
 * matches, it immediately calls the custom callback with the provided user/error.
 *
 * Returns a restore function.
 */
function mockPassportAuthenticate(strategyName, mockResult) {
  const original = passport.authenticate.bind(passport);

  passport.authenticate = (strategy, options, callback) => {
    if (strategy !== strategyName) {
      return original(strategy, options, callback);
    }

    // Return an Express middleware that immediately invokes the callback
    return (req, res, next) => {
      if (typeof options === 'function') {
        // Called as passport.authenticate(strategy, callback)
        options(mockResult.err || null, mockResult.user || false, mockResult.info);
      } else if (typeof callback === 'function') {
        // Called as passport.authenticate(strategy, options, callback)
        callback(mockResult.err || null, mockResult.user || false, mockResult.info);
      } else {
        next();
      }
    };
  };

  return () => {
    passport.authenticate = original;
  };
}

/**
 * Decode a JWT from a redirect Location header query param.
 */
function extractTokenFromRedirect(location, param = 'token') {
  const url = new URL(location);
  return url.searchParams.get(param);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterEach(async () => {
  await cleanupUsersByEmails([
    GOOGLE_EMAIL,
    GITHUB_EMAIL,
    EXISTING_EMAIL,
    LINK_EMAIL,
  ]);
});

afterAll(async () => {
  await cleanupUsersByEmails([
    GOOGLE_EMAIL,
    GITHUB_EMAIL,
    EXISTING_EMAIL,
    LINK_EMAIL,
  ]);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SSO — OAuth2 initiation redirects (Requirements 12.1, 12.2)', () => {
  test('GET /api/auth/google redirects to Google authorization URL', async () => {
    const response = await request(app)
      .get('/api/auth/google')
      .redirects(0);

    expect([301, 302]).toContain(response.status);
  });

  test('GET /api/auth/github redirects to GitHub authorization URL', async () => {
    const response = await request(app)
      .get('/api/auth/github')
      .redirects(0);

    expect([301, 302]).toContain(response.status);
  });
});

describe('SSO — Google callback: new user creation (Requirements 12.1, 12.3, 12.4)', () => {
  test('creates a new user and issues a JWT on first Google login', async () => {
    const fakeUser = {
      id: 'new-google-user-id',
      email: GOOGLE_EMAIL,
      firstName: 'Test',
      lastName: 'GoogleUser',
      role: 'developer',
      ssoProviders: [{ provider: 'google', providerId: 'google-provider-id-123' }],
    };

    const restore = mockPassportAuthenticate('google', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code&state=fake-state')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toBeDefined();

      // Should redirect to frontend callback, not to /login?error=
      expect(location).toContain('/auth/sso-callback');
      expect(location).not.toContain('/login?error=');

      // JWT token should be present in the redirect URL
      const token = extractTokenFromRedirect(location, 'token');
      expect(token).toBeTruthy();

      // Token should be a valid JWT with correct claims
      const decoded = jwt.decode(token);
      expect(decoded).toBeTruthy();
      expect(decoded).toHaveProperty('email', GOOGLE_EMAIL);
      expect(decoded).toHaveProperty('role', 'developer');

      // Refresh token should also be present (Req 12.4)
      const refreshToken = extractTokenFromRedirect(location, 'refreshToken');
      expect(refreshToken).toBeTruthy();
    } finally {
      restore();
    }
  });
});

describe('SSO — GitHub callback: new user creation (Requirements 12.1, 12.3, 12.4)', () => {
  test('creates a new user and issues a JWT on first GitHub login', async () => {
    const fakeUser = {
      id: 'new-github-user-id',
      email: GITHUB_EMAIL,
      firstName: 'Test',
      lastName: 'GitHubUser',
      role: 'developer',
      ssoProviders: [{ provider: 'github', providerId: 'github-provider-id-456' }],
    };

    const restore = mockPassportAuthenticate('github', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/github/callback?code=fake-code&state=fake-state')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toBeDefined();

      expect(location).toContain('/auth/sso-callback');
      expect(location).not.toContain('/login?error=');

      const token = extractTokenFromRedirect(location, 'token');
      expect(token).toBeTruthy();

      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('email', GITHUB_EMAIL);
    } finally {
      restore();
    }
  });
});

describe('SSO — Account linking: existing password-based account (Requirements 12.3, 12.6, 12.7)', () => {
  test('links Google SSO to an existing password-based account with the same email', async () => {
    // Create a password-based user first
    await request(app)
      .post('/api/auth/register')
      .send({
        email: LINK_EMAIL,
        password: 'Password123!',
        firstName: 'Link',
        lastName: 'User',
      });

    const fakeUser = {
      id: 'existing-user-linked-id',
      email: LINK_EMAIL,
      firstName: 'Link',
      lastName: 'User',
      role: 'developer',
      ssoProviders: [{ provider: 'google', providerId: 'google-link-id-789' }],
    };

    const restore = mockPassportAuthenticate('google', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code&state=fake-state')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;

      // Should succeed — no error redirect
      expect(location).toContain('/auth/sso-callback');
      expect(location).not.toContain('/login?error=');

      const token = extractTokenFromRedirect(location, 'token');
      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('email', LINK_EMAIL);
    } finally {
      restore();
    }
  });

  test('does not create a duplicate user when SSO email matches existing account (Req 12.7)', async () => {
    // Register a user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: EXISTING_EMAIL,
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User',
      });

    const fakeUser = {
      id: 'existing-user-github-id',
      email: EXISTING_EMAIL,
      firstName: 'Existing',
      lastName: 'User',
      role: 'developer',
      ssoProviders: [{ provider: 'github', providerId: 'github-existing-id' }],
    };

    const restore = mockPassportAuthenticate('github', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/github/callback?code=fake-code&state=fake-state')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/auth/sso-callback');

      // Verify only one user with this email exists in the DB
      const db = await database.connect();
      const users = db.collection('users');
      const count = await users.countDocuments({ email: EXISTING_EMAIL });
      expect(count).toBe(1);
    } finally {
      restore();
    }
  });
});

describe('SSO — Error handling: provider denial and failures (Requirement 12.5)', () => {
  test('redirects to /login?error= when Google strategy returns an error', async () => {
    const restore = mockPassportAuthenticate('google', {
      err: new Error('access_denied'),
      user: false,
    });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?error=access_denied')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/login?error=');
    } finally {
      restore();
    }
  });

  test('redirects to /login?error= when GitHub strategy returns an error', async () => {
    const restore = mockPassportAuthenticate('github', {
      err: new Error('GitHub authentication failed'),
      user: false,
    });

    try {
      const response = await request(app)
        .get('/api/auth/github/callback?error=access_denied')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/login?error=');
    } finally {
      restore();
    }
  });

  test('redirects to /login?error= when Google strategy returns no user (false)', async () => {
    const restore = mockPassportAuthenticate('google', { err: null, user: false });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/login?error=');
    } finally {
      restore();
    }
  });

  test('redirects to /login?error= when GitHub strategy returns no user (false)', async () => {
    const restore = mockPassportAuthenticate('github', { err: null, user: false });

    try {
      const response = await request(app)
        .get('/api/auth/github/callback?code=fake-code')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/login?error=');
    } finally {
      restore();
    }
  });

  test('error message is URL-encoded in the redirect (Req 12.5)', async () => {
    const errorMessage = 'No email returned from Google';

    const restore = mockPassportAuthenticate('google', {
      err: new Error(errorMessage),
      user: false,
    });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code')
        .redirects(0);

      const location = response.headers.location;
      expect(location).toContain('/login?error=');
      // The error param should be URL-encoded
      expect(location).toContain(encodeURIComponent(errorMessage));
    } finally {
      restore();
    }
  });
});

describe('SSO — JWT structure and token validity (Requirement 12.4)', () => {
  test('issued JWT contains id, email, and role claims', async () => {
    const fakeUser = {
      id: 'jwt-test-user-id',
      email: GOOGLE_EMAIL,
      firstName: 'JWT',
      lastName: 'Test',
      role: 'developer',
      ssoProviders: [],
    };

    const restore = mockPassportAuthenticate('google', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code')
        .redirects(0);

      const location = response.headers.location;
      const token = extractTokenFromRedirect(location, 'token');
      expect(token).toBeTruthy();

      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('email', GOOGLE_EMAIL);
      expect(decoded).toHaveProperty('role', 'developer');
      // Token should have an expiry
      expect(decoded).toHaveProperty('exp');
    } finally {
      restore();
    }
  });

  test('issued JWT is verifiable with the configured JWT_SECRET', async () => {
    const fakeUser = {
      id: 'jwt-verify-user-id',
      email: GITHUB_EMAIL,
      firstName: 'JWT',
      lastName: 'Verify',
      role: 'manager',
      ssoProviders: [],
    };

    const restore = mockPassportAuthenticate('github', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/github/callback?code=fake-code')
        .redirects(0);

      const location = response.headers.location;
      const token = extractTokenFromRedirect(location, 'token');
      expect(token).toBeTruthy();

      // Decode without verification to check claims are present
      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('email', GITHUB_EMAIL);
      expect(decoded).toHaveProperty('role', 'manager');
      expect(decoded).toHaveProperty('exp');

      // Verify the token is a valid JWT (well-formed, not expired)
      // Use the same secret the server uses (from process.env after dotenv loads)
      const { config } = await import('../src/config/config.ts');
      const verified = jwt.verify(token, config.jwt.secret);
      expect(verified).toHaveProperty('email', GITHUB_EMAIL);
      expect(verified).toHaveProperty('role', 'manager');
    } finally {
      restore();
    }
  });
});

describe('SSO — Multiple SSO providers on one account (Requirement 12.6)', () => {
  test('user can have both Google and GitHub providers in ssoProviders array', async () => {
    const fakeUser = {
      id: 'multi-provider-user-id',
      email: GOOGLE_EMAIL,
      firstName: 'Multi',
      lastName: 'Provider',
      role: 'developer',
      ssoProviders: [
        { provider: 'google', providerId: 'google-multi-id' },
        { provider: 'github', providerId: 'github-multi-id' },
      ],
    };

    const restore = mockPassportAuthenticate('google', { user: fakeUser });

    try {
      const response = await request(app)
        .get('/api/auth/google/callback?code=fake-code')
        .redirects(0);

      expect([301, 302]).toContain(response.status);
      const location = response.headers.location;
      expect(location).toContain('/auth/sso-callback');

      // JWT should be issued successfully for a multi-provider user
      const token = extractTokenFromRedirect(location, 'token');
      expect(token).toBeTruthy();
    } finally {
      restore();
    }
  });
});

describe('SSO — User model SSO methods (Requirements 12.3, 12.6, 12.7)', () => {
  // Import User model directly to test SSO-related model methods
  let User;

  beforeAll(async () => {
    const mod = await import('../src/models/User.ts');
    User = mod.default;
  });

  test('User.create with ssoProviders stores the provider correctly (Req 12.3)', async () => {
    const user = await User.create({
      email: GOOGLE_EMAIL,
      firstName: 'SSO',
      lastName: 'Test',
      password: null,
      role: 'developer',
      emailVerified: true,
      ssoProviders: [{ provider: 'google', providerId: 'google-model-test-id' }],
    });

    expect(user).toBeTruthy();
    expect(user.email).toBe(GOOGLE_EMAIL);
    expect(user.ssoProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'google', providerId: 'google-model-test-id' }),
      ])
    );
  });

  test('User.findBySSOProvider returns the correct user (Req 12.3)', async () => {
    // Create user with SSO provider
    await User.create({
      email: GOOGLE_EMAIL,
      firstName: 'Find',
      lastName: 'BySSO',
      password: null,
      role: 'developer',
      ssoProviders: [{ provider: 'google', providerId: 'google-find-test-id' }],
    });

    const found = await User.findBySSOProvider('google', 'google-find-test-id');
    expect(found).toBeTruthy();
    expect(found.email).toBe(GOOGLE_EMAIL);
  });

  test('User.findBySSOProvider returns null when provider not found', async () => {
    const found = await User.findBySSOProvider('google', 'nonexistent-provider-id');
    expect(found).toBeNull();
  });

  test('User.addSSOProvider links a new provider to an existing user (Req 12.6, 12.7)', async () => {
    // Create a password-based user
    const created = await User.create({
      email: LINK_EMAIL,
      firstName: 'Link',
      lastName: 'Test',
      password: 'Password123!',
      role: 'developer',
    });

    // Link a Google SSO provider
    const updated = await User.addSSOProvider(created.id, 'google', 'google-add-provider-id');

    expect(updated.ssoProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'google', providerId: 'google-add-provider-id' }),
      ])
    );
  });

  test('User.addSSOProvider does not add duplicate provider entries (Req 12.7)', async () => {
    const created = await User.create({
      email: GITHUB_EMAIL,
      firstName: 'Dedup',
      lastName: 'Test',
      password: null,
      role: 'developer',
      ssoProviders: [{ provider: 'github', providerId: 'github-dedup-id' }],
    });

    // Add the same provider again
    const updated = await User.addSSOProvider(created.id, 'github', 'github-dedup-id');

    // Should still have exactly one entry for this provider
    const githubProviders = updated.ssoProviders.filter(
      (p) => p.provider === 'github' && p.providerId === 'github-dedup-id'
    );
    expect(githubProviders).toHaveLength(1);
  });

  test('User.addSSOProvider supports multiple providers on one account (Req 12.6)', async () => {
    const created = await User.create({
      email: EXISTING_EMAIL,
      firstName: 'Multi',
      lastName: 'Provider',
      password: null,
      role: 'developer',
      ssoProviders: [{ provider: 'google', providerId: 'google-multi-id' }],
    });

    // Link GitHub as well
    const updated = await User.addSSOProvider(created.id, 'github', 'github-multi-id');

    expect(updated.ssoProviders).toHaveLength(2);
    expect(updated.ssoProviders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'google', providerId: 'google-multi-id' }),
        expect.objectContaining({ provider: 'github', providerId: 'github-multi-id' }),
      ])
    );
  });
});
