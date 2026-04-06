import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/config.js';
import { sendError } from '../utils/helpers.js';

/**
 * Generate JWT token
 * @param {object} payload - Token payload
 * @returns {string} JWT token
 */
export const generateToken = (payload: string | object | Buffer) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Verify JWT token (can handle both access and refresh tokens)
 * @param {string} token - JWT token
 * @param {boolean} isRefreshToken - Whether this is a refresh token
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token: string, isRefreshToken = false) => {
  const secret = isRefreshToken ? 
    (config.jwt.refreshSecret || config.jwt.secret) : 
    config.jwt.secret;
  return jwt.verify(token, secret);
};

/**
 * Hash password
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
export const hashPassword = async (password: string) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {boolean} Password match result
 */
export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Middleware to authenticate JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = verifyToken(token);
      req.user = typeof decoded === 'string' ? ({ id: decoded } as any) : (decoded as any);
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired', 401);
      } else if (error.name === 'JsonWebTokenError') {
        return sendError(res, 'Invalid token', 401);
      } else {
        return sendError(res, 'Token verification failed', 401);
      }
    }
  } catch (error) {
    return sendError(res, 'Authentication error', 500);
  }
};

// Alias for backward compatibility
export const authenticateToken = authenticate;

/**
 * Middleware to authorize user roles
 * @param {string[]} roles - Allowed roles
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }

    next();
  };
};

/**
 * Middleware to check if user owns resource or has admin/manager role
 */
export const authorizeOwnerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, 'Authentication required', 401);
  }

  const userId = req.params.userId || req.params.id;
  const isOwner = req.user.id === userId;
  const isAdminOrManager = ['admin', 'manager'].includes(req.user.role);

  if (!isOwner && !isAdminOrManager) {
    return sendError(res, 'Access denied', 403);
  }

  next();
};

/**
 * Generate refresh token
 * @param {object} payload - Token payload
 * @returns {string} Refresh JWT token
 */
export const generateRefreshToken = (payload: string | object | Buffer) => {
  return jwt.sign(payload, config.jwt.refreshSecret || config.jwt.secret, {
    expiresIn: (config.jwt.refreshExpiresIn || '7d') as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = verifyToken(token);
        req.user = typeof decoded === 'string' ? ({ id: decoded } as any) : (decoded as any);
      } catch (error) {
        // Silently ignore token errors for optional auth
        req.user = null;
      }
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};