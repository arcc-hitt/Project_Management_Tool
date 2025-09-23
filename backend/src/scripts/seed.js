import database from '../config/database.js';
import { config } from '../config/config.js';
import { fileURLToPath } from 'url';
import path from 'path';

// Execute seed files
const runSeeds = async () => {
  try {
  console.log('Seeding database with sample data...');
  console.log(`Target database: ${config.database.name}`);
    
    // Connect to database
    await database.connect();
    
    // Read and execute the seed SQL file
  const fs = await import('fs');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
    
    const seedPath = path.join(__dirname, '../../database/seeds/sample_data.sql');
    if (!fs.existsSync(seedPath)) {
  console.log('No seed file found (database/seeds/sample_data.sql). Skipping seeding.');
      return;
    }
  let seedSQL = fs.readFileSync(seedPath, 'utf8');

  // Remove any USE statements to avoid overriding configured DB
  seedSQL = seedSQL.replace(/\bUSE\s+[^;]+;/gi, '');

    // Helper: strip comments (line and block) for robust splitting
    const stripSqlComments = (sql) => {
      // Remove block comments /* ... */
      let s = sql.replace(/\/\*[\s\S]*?\*\//g, '');
      // Remove line comments starting with -- or #
      s = s.replace(/^\s*--.*$/gm, '');
      s = s.replace(/^\s*#.*$/gm, '');
      return s;
    };

    seedSQL = stripSqlComments(seedSQL);
    
    // Split SQL file into individual statements
    const statements = seedSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement
    // Temporarily disable foreign key checks to avoid ordering issues
    await database.query('SET FOREIGN_KEY_CHECKS=0');
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.query(statement);
          console.log('Executed seed statement');
        } catch (error) {
          // Ignore duplicate entry errors for idempotent seeding
          if (!error.message.includes('Duplicate entry')) {
            console.error('Seed error:', error.message);
            throw error;
          } else {
            console.log('Skipping duplicate entry');
          }
        }
      }
    }
    await database.query('SET FOREIGN_KEY_CHECKS=1');

    console.log('Sample data has been inserted successfully');

    // Summary counts
    try {
      const [[usersCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM users'),
      ]);
      const [[projectsCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM projects'),
      ]);
      const [[tasksCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM tasks'),
      ]);
      const [[commentsCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM task_comments'),
      ]);
      const [[storiesCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM user_stories'),
      ]);
      const [[notifsCount]] = await Promise.all([
        database.query('SELECT COUNT(*) AS c FROM notifications'),
      ]);
      console.log('Seed summary:', {
        users: usersCount?.c,
        projects: projectsCount?.c,
        tasks: tasksCount?.c,
        comments: commentsCount?.c,
        user_stories: storiesCount?.c,
        notifications: notifsCount?.c,
      });
    } catch (sumErr) {
      console.warn('Could not compute seed summary counts:', sumErr.message);
    }

    console.log('Database seeding completed successfully');
    
  } catch (error) {
  console.error('Seeding failed:', error.message);
    throw error;
  } finally {
    await database.close();
  }
};

// Run seeds if this file is executed directly (robust cross-platform check)
const __seedFilename = fileURLToPath(import.meta.url);
const isDirectRun = (() => {
  try {
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    const current = path.resolve(__seedFilename);
    return invoked && invoked === current;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  runSeeds()
    .then(() => {
  console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
  console.error('Seeding failed:', error);
      process.exit(1);
    });
}