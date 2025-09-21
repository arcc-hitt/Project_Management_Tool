import database from '../config/database.js';
import { config } from '../config/config.js';

// Execute base migration file (001). Note: 002 contains TRIGGERs and DELIMITER directives
// that are not compatible with naive splitting; tests and basic setup only require 001.
export const runMigrations = async () => {
  try {
  console.log('Running database migrations...');
    
    // Connect to database
    await database.connect();

    // Acquire advisory lock to avoid concurrent migrations from parallel test workers
    try {
      const lockRows = await database.query('SELECT GET_LOCK(?, 30) AS locked', ['pm_tool_migrate_lock']);
      if (!lockRows || lockRows[0]?.locked !== 1) {
        throw new Error('Failed to acquire migration lock');
      }
    } catch (e) {
      // If GET_LOCK isn't available or fails, proceed without it; ensureColumn guards will handle duplicates
    }
    
    // Read and execute the migration SQL file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const migrationPath = path.join(__dirname, '../../database/migrations/001_create_database.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Replace hardcoded DB name with configured DB name for current environment (e.g., tests)
    const targetDbName = config.database.name;
    migrationSQL = migrationSQL.replaceAll('project_management_tool', targetDbName);
    
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
          console.log('Executed:', statement.substring(0, 50) + '...');
        } catch (error) {
          // Ignore "database exists" and "table exists" errors
          if (!error.message.includes('already exists')) {
            console.error('Migration error:', error.message);
            throw error;
          }
        }
      }
    }
    
    // Apply essential enhancements required by models (subset of 002)
    const ensureColumn = async (table, column, definition) => {
      const existsRows = await database.query(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [targetDbName, table, column]
      );
      if (existsRows.length === 0) {
        try {
          await database.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (e) {
          // Ignore race conditions if another worker added it concurrently
          if (!/Duplicate column name/i.test(e.message)) {
            throw e;
          }
        }
      }
    };

    const ensureTable = async (table, createSqlBuilder, fallbackSqlBuilder = null) => {
      const tableRows = await database.query(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
        [targetDbName, table]
      );
      if (tableRows.length === 0) {
        try {
          const sql = createSqlBuilder();
          await database.query(sql);
        } catch (e) {
          // If JSON type unsupported or other feature issues, try fallback when provided
          if (fallbackSqlBuilder) {
            const fallbackSql = fallbackSqlBuilder();
            await database.query(fallbackSql);
          } else {
            throw e;
          }
        }
      }
    };

    await ensureColumn('users', 'last_login', 'TIMESTAMP NULL');
    await ensureColumn('users', 'phone', 'VARCHAR(20)');
    await ensureColumn('users', 'timezone', "VARCHAR(50) DEFAULT 'UTC'");
    await ensureColumn('users', 'email_verified', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn('users', 'email_verified_at', 'TIMESTAMP NULL');

    // Ensure additional project columns expected by the model exist
    await ensureColumn('projects', 'budget', 'DECIMAL(12,2) NULL');
    await ensureColumn('projects', 'actual_cost', 'DECIMAL(12,2) NULL');
    await ensureColumn('projects', 'progress_percentage', 'INT DEFAULT 0');
    await ensureColumn('projects', 'repository_url', 'VARCHAR(255) NULL');
    // Prefer JSON if available; fallback to TEXT if JSON type unsupported is acceptable at runtime
    try {
      await ensureColumn('projects', 'tags', 'JSON NULL');
    } catch (e) {
      // If adding JSON fails (older MySQL), try TEXT as a fallback
      const existsRows = await database.query(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [targetDbName, 'projects', 'tags']
      );
      if (existsRows.length === 0) {
        await database.query('ALTER TABLE projects ADD COLUMN tags TEXT NULL');
      }
    }

    // Ensure additional task columns expected by the model exist
    // completed_at for marking done, tags/story_points/blocked fields for metadata
    await ensureColumn('tasks', 'completed_at', 'TIMESTAMP NULL');
    try {
      await ensureColumn('tasks', 'tags', 'JSON NULL');
    } catch (e) {
      const existsRowsTaskTags = await database.query(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [targetDbName, 'tasks', 'tags']
      );
      if (existsRowsTaskTags.length === 0) {
        await database.query('ALTER TABLE tasks ADD COLUMN tags TEXT NULL');
      }
    }
    await ensureColumn('tasks', 'story_points', 'INT NULL');
    await ensureColumn('tasks', 'blocked', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn('tasks', 'blocked_reason', 'TEXT NULL');

  // Ensure notification columns used by models exist (subset of enhancements)
  await ensureColumn('notifications', 'is_read', 'BOOLEAN DEFAULT FALSE');
  await ensureColumn('notifications', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  // entity linking columns for richer notifications
  await ensureColumn('notifications', 'entity_type', "ENUM('task','project','user_story','comment') NULL");
  await ensureColumn('notifications', 'entity_id', 'INT NULL');

    // Ensure task_comments has an updated_at column for update timestamps
    await ensureColumn('task_comments', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    // Ensure activity_logs table exists (used by ActivityLog model)
    await ensureTable(
      'activity_logs',
      () => `CREATE TABLE IF NOT EXISTS activity_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type ENUM('user','project','task','comment','file') NOT NULL,
        entity_id INT NOT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,
      // Fallback for environments without JSON support
      () => `CREATE TABLE IF NOT EXISTS activity_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type ENUM('user','project','task','comment','file') NOT NULL,
        entity_id INT NOT NULL,
        old_values TEXT NULL,
        new_values TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`
    );

    // Ensure time_entries table exists (used by TimeEntry model and dashboard)
    await ensureTable(
      'time_entries',
      () => `CREATE TABLE IF NOT EXISTS time_entries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        description TEXT NULL,
        hours_spent DECIMAL(5,2) NOT NULL DEFAULT 0,
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_task_id (task_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_time_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_time_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );

    // Ensure updated_at column exists on time_entries for updates in model
    await ensureColumn('time_entries', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  console.log('Database migrations completed successfully');
    
  } catch (error) {
  console.error('Migration failed:', error.message);
    throw error;
  } finally {
    // Release advisory lock if held
    try {
      await database.query('SELECT RELEASE_LOCK(?)', ['pm_tool_migrate_lock']);
    } catch (e) {
      // ignore
    }
    await database.close();
  }
};

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
  console.log('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
  console.error('Migration failed:', error);
      process.exit(1);
    });
}