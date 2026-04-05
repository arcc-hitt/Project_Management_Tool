import database from '../src/config/database.js';
import { normalizeId, toObjectId } from '../src/utils/mongo.js';

const getCollections = async () => {
  const db = await database.connect();
  return {
    users: db.collection('users'),
    projects: db.collection('projects'),
    tasks: db.collection('tasks'),
    projectMembers: db.collection('project_members'),
    taskComments: db.collection('task_comments'),
    notifications: db.collection('notifications'),
    activityLogs: db.collection('activity_logs'),
    timeEntries: db.collection('time_entries'),
  };
};

export const findUserIdByEmail = async (email) => {
  const { users } = await getCollections();
  const user = await users.findOne({ email }, { projection: { _id: 1 } });
  return user ? normalizeId(user._id) : null;
};

export const cleanupUserById = async (userId) => {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) return;

  const { users, projects, tasks, projectMembers, taskComments, notifications, activityLogs, timeEntries } = await getCollections();

  const createdProjects = await projects.find({ createdBy: userId }, { projection: { _id: 1 } }).toArray();
  const projectIds = createdProjects.map((p) => normalizeId(p._id));

  const taskFilter = {
    $or: [
      { createdBy: userId },
      { assignedTo: userId },
      ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
    ],
  };
  const relatedTasks = await tasks.find(taskFilter, { projection: { _id: 1 } }).toArray();
  const taskIds = relatedTasks.map((t) => normalizeId(t._id));

  await projectMembers.deleteMany({
    $or: [
      { userId },
      ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
    ],
  });

  if (taskIds.length) {
    await taskComments.deleteMany({ $or: [{ userId }, { taskId: { $in: taskIds } }] });
    await timeEntries.deleteMany({ $or: [{ userId }, { taskId: { $in: taskIds } }] });
    await tasks.deleteMany({ _id: { $in: taskIds.map((id) => toObjectId(id)).filter(Boolean) } });
  } else {
    await taskComments.deleteMany({ userId });
    await timeEntries.deleteMany({ userId });
  }

  await notifications.deleteMany({ userId });
  await activityLogs.deleteMany({ userId });

  if (projectIds.length) {
    await projects.deleteMany({ _id: { $in: projectIds.map((id) => toObjectId(id)).filter(Boolean) } });
  }

  await users.deleteOne({ _id: userObjectId });
};

export const cleanupUserByEmail = async (email) => {
  const userId = await findUserIdByEmail(email);
  if (!userId) return;
  await cleanupUserById(userId);
};

export const cleanupUsersByEmails = async (emails = []) => {
  for (const email of emails) {
    await cleanupUserByEmail(email);
  }
};

export const clearProjectDomainData = async () => {
  const { projects, tasks, projectMembers, taskComments, notifications, activityLogs, timeEntries } = await getCollections();
  await projectMembers.deleteMany({});
  await taskComments.deleteMany({});
  await timeEntries.deleteMany({});
  await tasks.deleteMany({});
  await projects.deleteMany({});
  await notifications.deleteMany({});
  await activityLogs.deleteMany({});
};

export const deleteUsersByEmailRegex = async (pattern) => {
  const { users } = await getCollections();
  const rows = await users.find({ email: { $regex: pattern } }, { projection: { _id: 1 } }).toArray();
  for (const row of rows) {
    await cleanupUserById(normalizeId(row._id));
  }
};
