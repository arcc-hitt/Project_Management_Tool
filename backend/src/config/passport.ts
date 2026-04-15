import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '../models/index.js';
import { config } from './config.js';

/**
 * Configure Passport.js strategies for Google and GitHub OAuth2.
 *
 * Strategy callback logic (Requirements 12.1, 12.3, 12.6, 12.7):
 *  1. Try to find an existing user by SSO provider + providerId.
 *  2. If found, return that user (already linked).
 *  3. If not found, look up by email.
 *     a. If an account with that email exists, link the SSO provider to it.
 *     b. If no account exists, create a new user.
 */

// ─── Google Strategy ──────────────────────────────────────────────────────────

passport.use(
  new GoogleStrategy(
    {
      clientID: config.sso.google.clientId,
      clientSecret: config.sso.google.clientSecret,
      callbackURL: config.sso.google.callbackUrl,
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const providerId = profile.id;
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;

        if (!email) {
          return done(new Error('No email returned from Google'), undefined);
        }

        // 1. Check if already linked
        let user = await User.findBySSOProvider('google', providerId);
        if (user) {
          return done(null, user);
        }

        // 2. Find by email — link or create
        user = await User.findByEmail(email);
        if (user) {
          // Link SSO provider to existing account (Req 12.7)
          user = await User.addSSOProvider(user.id, 'google', providerId);
          return done(null, user);
        }

        // 3. Create new user (Req 12.3)
        const firstName =
          profile.name?.givenName ||
          (profile.displayName ? profile.displayName.split(' ')[0] : 'User');
        const lastName =
          profile.name?.familyName ||
          (profile.displayName && profile.displayName.split(' ').length > 1
            ? profile.displayName.split(' ').slice(1).join(' ')
            : 'Unknown');

        user = await User.create({
          email,
          firstName,
          lastName,
          // No password for SSO-only accounts
          password: null,
          role: 'developer',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          ssoProviders: [{ provider: 'google', providerId }],
        });

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// ─── GitHub Strategy ──────────────────────────────────────────────────────────

passport.use(
  new GitHubStrategy(
    {
      clientID: config.sso.github.clientId,
      clientSecret: config.sso.github.clientSecret,
      callbackURL: config.sso.github.callbackUrl,
      scope: ['user:email'],
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: (err: Error | null, user?: any) => void) => {
      try {
        const providerId = profile.id?.toString();
        // GitHub may return multiple emails; prefer the primary/verified one
        const emailEntry =
          profile.emails?.find((e: any) => e.primary && e.verified) ||
          profile.emails?.find((e: any) => e.verified) ||
          profile.emails?.[0];
        const email = emailEntry?.value || null;

        if (!email) {
          return done(new Error('No email returned from GitHub'), undefined);
        }

        // 1. Check if already linked
        let user = await User.findBySSOProvider('github', providerId);
        if (user) {
          return done(null, user);
        }

        // 2. Find by email — link or create
        user = await User.findByEmail(email);
        if (user) {
          user = await User.addSSOProvider(user.id, 'github', providerId);
          return done(null, user);
        }

        // 3. Create new user
        const displayName = profile.displayName || profile.username || 'GitHub User';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || 'GitHub';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        user = await User.create({
          email,
          firstName,
          lastName,
          password: null,
          role: 'developer',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          ssoProviders: [{ provider: 'github', providerId }],
        });

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// Passport session serialization (not used for JWT flow, but required by passport)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
