import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'project_management_tool',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:51773',
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
};