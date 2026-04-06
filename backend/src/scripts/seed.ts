import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import database from '../config/database.js';
import { normalizeId } from '../utils/mongo.js';

const runSeeds = async () => {
  try {
    console.log('Seeding MongoDB with sample data...');
    const db = await database.connect();

    const usersCol = db.collection('users');
    const projectsCol = db.collection('projects');
    const membersCol = db.collection('project_members');
    const tasksCol = db.collection('tasks');
    const commentsCol = db.collection('task_comments');
    const notificationsCol = db.collection('notifications');

    const samplePassword = 'Password123!';
    const sampleUserBlueprints = [
      { firstName: 'Admin', lastName: 'User', email: 'admin@example.com', role: 'admin' },
      { firstName: 'Sarah', lastName: 'Manager', email: 'manager@example.com', role: 'manager' },
      { firstName: 'John', lastName: 'Developer', email: 'dev1@example.com', role: 'developer' },
      { firstName: 'Emma', lastName: 'Developer', email: 'dev2@example.com', role: 'developer' },
    ];
    const sampleEmails = sampleUserBlueprints.map((user) => user.email);

    const userCount = await usersCol.countDocuments();
    if (userCount > 0) {
      const now = new Date();
      const passwordHash = await bcrypt.hash(samplePassword, 10);
      const existingSampleUsers = await usersCol
        .find({ email: { $in: sampleEmails } })
        .project({ _id: 1, email: 1 })
        .toArray();

      if (existingSampleUsers.length > 0) {
        await usersCol.bulkWrite(
          existingSampleUsers.map((user) => ({
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  passwordHash,
                  isActive: true,
                  emailVerified: true,
                  updatedAt: now,
                },
              },
            },
          }))
        );

        console.log(
          `Updated ${existingSampleUsers.length} sample user password(s) to a frontend-compliant value.`
        );
      }

      console.log('Users collection is not empty, skipping fresh seed insertion.');
      return;
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(samplePassword, 10);

    const users = sampleUserBlueprints.map((user) => ({
      ...user,
      isActive: true,
      passwordHash,
      timezone: 'UTC',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    }));

    const userResult = await usersCol.insertMany(users);
    const insertedUsers = (Object.values(userResult.insertedIds) as ObjectId[]).map((id) => id.toHexString());

    const projects = [
      { name: 'E-commerce Platform', description: 'A modern e-commerce website with cart and payment functionality', status: 'active', priority: 'high', startDate: now, endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), createdBy: insertedUsers[1], createdAt: now, updatedAt: now },
      { name: 'Mobile App Development', description: 'iOS and Android app for e-commerce platform', status: 'planning', priority: 'medium', startDate: now, endDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000), createdBy: insertedUsers[1], createdAt: now, updatedAt: now },
      { name: 'Data Analytics Dashboard', description: 'Business intelligence dashboard for sales analytics', status: 'active', priority: 'medium', startDate: now, endDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000), createdBy: insertedUsers[0], createdAt: now, updatedAt: now },
    ];

    const projectResult = await projectsCol.insertMany(projects);
    const insertedProjects = (Object.values(projectResult.insertedIds) as ObjectId[]).map((id) => id.toHexString());

    const members = [
      { projectId: insertedProjects[0], userId: insertedUsers[1], role: 'manager', joinedAt: now },
      { projectId: insertedProjects[0], userId: insertedUsers[2], role: 'developer', joinedAt: now },
      { projectId: insertedProjects[0], userId: insertedUsers[3], role: 'developer', joinedAt: now },
      { projectId: insertedProjects[1], userId: insertedUsers[1], role: 'manager', joinedAt: now },
      { projectId: insertedProjects[2], userId: insertedUsers[0], role: 'manager', joinedAt: now },
      { projectId: insertedProjects[2], userId: insertedUsers[2], role: 'developer', joinedAt: now },
    ];
    await membersCol.insertMany(members);

    const tasks = [
      { projectId: insertedProjects[0], title: 'Design product catalog UI', description: 'Create responsive product listing and detail pages', status: 'in_progress', priority: 'high', assignedTo: insertedUsers[2], createdBy: insertedUsers[1], dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), estimatedHours: 24, actualHours: 8, createdAt: now, updatedAt: now },
      { projectId: insertedProjects[0], title: 'Implement shopping cart', description: 'Add cart update and checkout flow', status: 'todo', priority: 'medium', assignedTo: insertedUsers[3], createdBy: insertedUsers[1], dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), estimatedHours: 20, actualHours: 0, createdAt: now, updatedAt: now },
      { projectId: insertedProjects[2], title: 'Build KPI dashboard widgets', description: 'Revenue and retention widgets', status: 'in_progress', priority: 'high', assignedTo: insertedUsers[2], createdBy: insertedUsers[0], dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), estimatedHours: 16, actualHours: 4, createdAt: now, updatedAt: now },
    ];

    const taskResult = await tasksCol.insertMany(tasks);
    const insertedTasks = (Object.values(taskResult.insertedIds) as ObjectId[]).map((id) => id.toHexString());

    await commentsCol.insertMany([
      { taskId: insertedTasks[0], userId: insertedUsers[1], comment: 'Great progress, keep iterating on spacing.', createdAt: now, updatedAt: now },
      { taskId: insertedTasks[0], userId: insertedUsers[2], comment: 'Will push a revised prototype by EOD.', createdAt: now, updatedAt: now },
    ]);

    await notificationsCol.insertMany([
      { userId: insertedUsers[2], type: 'task_assigned', title: 'New Task Assigned', message: 'You have been assigned a task.', entityType: 'task', entityId: insertedTasks[0], isRead: false, createdAt: now, updatedAt: now },
      { userId: insertedUsers[3], type: 'task_assigned', title: 'New Task Assigned', message: 'You have been assigned a task.', entityType: 'task', entityId: insertedTasks[1], isRead: false, createdAt: now, updatedAt: now },
    ]);

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    throw error;
  } finally {
    await database.close();
  }
};

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));
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
