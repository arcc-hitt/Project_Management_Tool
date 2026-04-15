import express from 'express';
import passport from '../config/passport.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { config } from '../config/config.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the frontend redirect URL after a successful SSO login.
 * The JWT is passed as a query param so the SSOCallbackPage can pick it up.
 */
function buildSuccessRedirect(user: any): string {
  const accessToken = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
  });

  const frontendUrl = config.cors.origin;
  return `${frontendUrl}/auth/sso-callback?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
}

/**
 * Build the frontend error redirect URL (Req 12.5).
 */
function buildErrorRedirect(message: string): string {
  const frontendUrl = config.cors.origin;
  return `${frontendUrl}/login?error=${encodeURIComponent(message)}`;
}

// ─── Google OAuth2 ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth2 login
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirect to Google authorization page
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth2 callback
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirect to frontend with JWT token or error
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err: Error | null, user: any) => {
    if (err || !user) {
      const message = err?.message || 'Google authentication failed';
      return res.redirect(buildErrorRedirect(message));
    }
    return res.redirect(buildSuccessRedirect(user));
  })(req, res, next);
});

// ─── GitHub OAuth2 ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth2 login
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirect to GitHub authorization page
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
);

/**
 * @swagger
 * /api/auth/github/callback:
 *   get:
 *     summary: GitHub OAuth2 callback
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirect to frontend with JWT token or error
 */
router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', { session: false }, (err: Error | null, user: any) => {
    if (err || !user) {
      const message = err?.message || 'GitHub authentication failed';
      return res.redirect(buildErrorRedirect(message));
    }
    return res.redirect(buildSuccessRedirect(user));
  })(req, res, next);
});

export default router;
