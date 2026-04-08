import database from '../config/database.js';
import type { IndexSpecification, CreateIndexesOptions } from 'mongodb';

/**
 * Migration: rename `tasks` collection to `issues`.
 * - Copies all documents from `tasks` into `issues`, adding `issueType: 'task'` default where missing.
 * - Preserves all existing `_id` values.
 * - Skips if `tasks` collection does not exist or is empty.
 */
export const migrateTasksToIssues = async () => {
  const db = await database.connect();
  const collections = await db.listCollections({ name: 'tasks' }).toArray();
  if (collections.length === 0) {
    console.log('No `tasks` collection found — skipping tasks→issues migration.');
    return;
  }

  const tasksCol = db.collection('tasks');
  const issuesCol = db.collection('issues');

  const taskCount = await tasksCol.countDocuments();
  if (taskCount === 0) {
    console.log('`tasks` collection is empty — skipping tasks→issues migration.');
    return;
  }

  console.log(`Migrating ${taskCount} documents from \`tasks\` → \`issues\`...`);

  const cursor = tasksCol.find({});
  let migrated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const existing = await issuesCol.findOne({ _id: doc._id });
    if (existing) {
      skipped++;
      continue;
    }
    if (!doc.issueType) {
      doc.issueType = 'task';
    }
    await issuesCol.insertOne(doc);
    migrated++;
  }

  console.log(`tasks→issues migration complete: ${migrated} migrated, ${skipped} already present.`);
};

export const runMigrations = async () => {
  try {
    console.log('Running MongoDB initialization...');
    const db = await database.connect();

    // Run data migrations before index creation
    await migrateTasksToIssues();

    const indexPlans: Array<[string, IndexSpecification, CreateIndexesOptions?]> = [
      ['users', { email: 1 }, { unique: true }],
      ['users', { role: 1, isActive: 1 }],
      ['projects', { createdBy: 1 }],
      ['projects', { status: 1, priority: 1 }],
      // Legacy tasks indexes (kept for backward compat)
      ['tasks', { projectId: 1, status: 1 }],
      ['tasks', { assignedTo: 1, dueDate: 1 }],
      ['tasks', { title: 'text', description: 'text' }],
      // Issues collection indexes (Req 16.4)
      ['issues', { projectId: 1 }],
      ['issues', { sprintId: 1 }],
      ['issues', { assignedTo: 1 }],
      ['issues', { status: 1 }],
      ['issues', { issueType: 1 }],
      ['issues', { createdAt: 1 }],
      ['issues', { projectId: 1, status: 1 }],
      ['issues', { title: 'text', description: 'text' }],
      // Sprints indexes (Req 16.5)
      ['sprints', { projectId: 1 }],
      ['sprints', { projectId: 1, state: 1 }],
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
        console.warn(`Index creation warning for ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('MongoDB initialization completed successfully');
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
};

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'));
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
