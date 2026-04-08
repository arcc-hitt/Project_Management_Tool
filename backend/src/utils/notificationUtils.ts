import { EventEmitter } from 'events';
import Notification from '../models/Notification.js';
import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId } from './mongo.js';

export const notificationEmitter = new EventEmitter();

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  metadata = null,
}) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    entityType: relatedEntityType,
    entityId: relatedEntityId,
    metadata,
  });

  notificationEmitter.emit('notification', { userId, notification });
  return notification;
};

export const createBulkNotifications = async (userIds, notificationData) => {
  const promises = userIds.map((userId) => createNotification({ userId, ...notificationData }));
  return Promise.all(promises);
};

export const notifyProjectMembers = async (projectId, notificationData, excludeUserId = null) => {
  const membersCol = await database.getCollection('project_members');
  const filter: Record<string, any> = { projectId };
  if (excludeUserId) filter.userId = { $ne: excludeUserId };

  const members = await membersCol.find(filter).toArray();
  const userIds = [...new Set(members.map((m) => m.userId))];

  if (!userIds.length) return [];
  return createBulkNotifications(userIds, {
    ...notificationData,
    relatedEntityType: 'project',
    relatedEntityId: projectId,
  });
};

export const notifyTaskAssignees = async (taskId, notificationData, excludeUserId = null) => {
  const task = await (await database.getCollection('tasks')).findOne({ _id: toObjectId(taskId) });
  if (!task?.assignedTo) return [];
  if (excludeUserId && task.assignedTo === excludeUserId) return [];

  return createBulkNotifications([task.assignedTo], {
    ...notificationData,
    relatedEntityType: 'task',
    relatedEntityId: taskId,
  });
};

export const createDeadlineReminder = async (entityType, entityId, deadline, reminderHours = 24) => {
  const reminderTime = new Date(deadline.getTime() - (reminderHours * 60 * 60 * 1000));
  if (reminderTime <= new Date()) return;

  let entityName;
  let userIds = [];

  if (entityType === 'task') {
    const task = await (await database.getCollection('tasks')).findOne({ _id: toObjectId(entityId) });
    if (!task) return;
    entityName = task.title;
    if (task.assignedTo) userIds = [task.assignedTo];
  } else if (entityType === 'project') {
    const project = await (await database.getCollection('projects')).findOne({ _id: toObjectId(entityId) });
    if (!project) return;
    entityName = project.name;
    const members = await (await database.getCollection('project_members')).find({ projectId: entityId }).toArray();
    userIds = members.map((m) => m.userId);
  }

  if (!userIds.length) return;

  return createBulkNotifications(userIds, {
    type: 'deadline',
    title: `Deadline Reminder: ${entityName}`,
    message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} "${entityName}" is due in ${reminderHours} hours.`,
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    metadata: { deadline: deadline.toISOString(), reminderHours },
  });
};

export const createMentionNotification = async (
  mentionedUserId,
  mentionedByUserId,
  context,
  entityType,
  entityId
) => {
  const user = await (await database.getCollection('users')).findOne({ _id: toObjectId(mentionedByUserId) });
  if (!user) return;

  const mentionedByName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  return createNotification({
    userId: mentionedUserId,
    type: 'mention',
    title: `You were mentioned by ${mentionedByName}`,
    message: context,
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    metadata: { mentionedBy: mentionedByUserId, mentionedByName },
  });
};

export const checkUpcomingDeadlines = async () => {
  try {
    const now = new Date();
    const next72Hours = new Date(now.getTime() + (72 * 60 * 60 * 1000));

    const tasks = await (await database.getCollection('tasks')).find({
      dueDate: { $gte: now, $lte: next72Hours },
      status: { $ne: 'completed' },
    }).toArray();

    const projects = await (await database.getCollection('projects')).find({
      endDate: { $gte: now, $lte: next72Hours },
      status: { $ne: 'completed' },
    }).toArray();

    for (const task of tasks) {
      const dueDate = new Date(task.dueDate);
      const hoursUntilDeadline = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      if (hoursUntilDeadline <= 24) {
        await createDeadlineReminder('task', normalizeId(task._id), dueDate, hoursUntilDeadline);
      } else if (hoursUntilDeadline <= 72) {
        await createDeadlineReminder('task', normalizeId(task._id), dueDate, 72);
      }
    }

    for (const project of projects) {
      const endDate = new Date(project.endDate);
      const hoursUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      if (hoursUntilDeadline <= 24) {
        await createDeadlineReminder('project', normalizeId(project._id), endDate, hoursUntilDeadline);
      } else if (hoursUntilDeadline <= 72) {
        await createDeadlineReminder('project', normalizeId(project._id), endDate, 72);
      }
    }

    console.log(`Checked ${tasks.length} tasks and ${projects.length} projects for upcoming deadlines`);
  } catch (error) {
    console.error('Error checking upcoming deadlines:', error);
  }
};

export const scheduleDeadlineReminders = () => {
  setInterval(checkUpcomingDeadlines, 60 * 60 * 1000);
  checkUpcomingDeadlines();
};

export const getNotificationTemplate = (type, data) => {
  const templates = {
    task_assigned: {
      title: `New Task Assigned: ${data.taskTitle}`,
      message: `You have been assigned to the task "${data.taskTitle}" in project "${data.projectName}".`,
    },
    task_completed: {
      title: `Task Completed: ${data.taskTitle}`,
      message: `The task "${data.taskTitle}" has been marked as completed by ${data.completedBy}.`,
    },
    task_updated: {
      title: `Task Updated: ${data.taskTitle}`,
      message: `The task "${data.taskTitle}" has been updated by ${data.updatedBy}.`,
    },
    project_created: {
      title: `New Project: ${data.projectName}`,
      message: `You have been added to the project "${data.projectName}".`,
    },
    project_updated: {
      title: `Project Updated: ${data.projectName}`,
      message: `The project "${data.projectName}" has been updated by ${data.updatedBy}.`,
    },
    deadline_reminder: {
      title: `Deadline Reminder: ${data.entityName}`,
      message: `${data.entityType} "${data.entityName}" is due soon.`,
    },
    comment_added: {
      title: `New Comment: ${data.entityName}`,
      message: `${data.commenterName} added a comment to "${data.entityName}".`,
    },
  };

  return templates[type] || {
    title: 'Notification',
    message: 'You have a new notification.',
  };
};
