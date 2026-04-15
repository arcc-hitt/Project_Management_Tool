import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    name: process.env.MONGODB_DB_NAME || 'project-management-tool-db',
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  
  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  },
  
  // GROQ API Configuration
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
  },

  // SSO / OAuth2 Configuration
  sso: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        `http://localhost:${process.env.PORT || 5000}/api/auth/github/callback`,
    },
  },
};