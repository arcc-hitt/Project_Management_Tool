import database from '../config/database.js';

// Execute seed files
const runSeeds = async () => {
  try {
    console.log('🌱 Seeding database with sample data...');
    
    // Connect to database
    await database.connect();
    
    // Read and execute the seed SQL file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const seedPath = path.join(__dirname, '../../database/seeds/sample_data.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    // Split SQL file into individual statements
    const statements = seedSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await database.query(statement);
          console.log('✅ Executed seed statement');
        } catch (error) {
          // Ignore duplicate entry errors for idempotent seeding
          if (!error.message.includes('Duplicate entry')) {
            console.error('❌ Seed error:', error.message);
            throw error;
          } else {
            console.log('⚠️  Skipping duplicate entry');
          }
        }
      }
    }
    
    console.log('✅ Database seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await database.close();
  }
};

// Run seeds if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds()
    .then(() => {
      console.log('🎉 Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}