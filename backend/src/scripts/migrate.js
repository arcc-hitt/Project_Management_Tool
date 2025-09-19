import database from '../config/database.js';
import { formatDateForDB } from '../utils/helpers.js';

// Execute migration files
const runMigrations = async () => {
  try {
    console.log('🔄 Running database migrations...');
    
    // Connect to database
    await database.connect();
    
    // Read and execute the migration SQL file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const migrationPath = path.join(__dirname, '../../database/migrations/001_create_database.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL file into individual statements
    const statements = migrationSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.query(statement);
          console.log('✅ Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          // Ignore "database exists" and "table exists" errors
          if (!error.message.includes('already exists')) {
            console.error('❌ Migration error:', error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Database migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await database.close();
  }
};

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}