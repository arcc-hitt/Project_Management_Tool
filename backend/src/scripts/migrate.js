import database from '../config/database.js';

export const runMigrations = async () => {
  try {
    console.log('Running MongoDB initialization...');
    const db = await database.connect();

    const indexPlans = [
      ['users', { email: 1 }, { unique: true }],
      ['users', { role: 1, isActive: 1 }],
      ['projects', { createdBy: 1 }],
      ['projects', { status: 1, priority: 1 }],
      ['tasks', { projectId: 1, status: 1 }],
      ['tasks', { assignedTo: 1, dueDate: 1 }],
      ['tasks', { title: 'text', description: 'text' }],
      ['task_comments', { taskId: 1, createdAt: 1 }],
      ['task_comments', { userId: 1 }],
      ['project_members', { projectId: 1, userId: 1 }, { unique: true }],
      ['notifications', { userId: 1, createdAt: -1 }],
      ['notifications', { isRead: 1 }],
      ['activity_logs', { userId: 1, createdAt: -1 }],
      ['activity_logs', { entityType: 1, entityId: 1 }],
      ['time_entries', { userId: 1, startTime: -1 }],
      ['time_entries', { taskId: 1 }],
    ];

    for (const [collectionName, spec, opts] of indexPlans) {
      try {
        await db.collection(collectionName).createIndex(spec, opts || {});
      } catch (error) {
        console.warn(`Index creation warning for ${collectionName}: ${error.message}`);
      }
    }

    console.log('MongoDB initialization completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
};

const isDirectRun = process.argv[1] && process.argv[1].endsWith('migrate.js');
if (isDirectRun) {
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
