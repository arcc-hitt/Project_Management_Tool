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
  // Persist notification record first — must succeed even if emit fails
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    entityType: relatedEntityType,
    entityId: relatedEntityId,
    metadata,
  });

  // Emit Socket.IO event; wrapped in try/catch per Req 4.7
  try {
    notificationEmitter.emit('notification:new', { userId, notification });
    // Also emit on legacy 'notification' channel for backward compat
    notificationEmitter.emit('notification', { userId, notification });
  } catch (emitErr) {
    console.error('Socket.IO emit failed (notification persisted):', emitErr);
  }

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

/**
 * Notify a user that an issue was assigned to them (Req 4.1).
 */
export const notifyIssueAssigned = async (issueId: string, assigneeId: string, assignerId: string) => {
  try {
    const issues = await database.getCollection('issues');
    const users = await database.getCollection('users');

    const issue = await issues.findOne({ _id: toObjectId(issueId) });
    if (!issue) return null;

    const assigner = await users.findOne({ _id: toObjectId(assignerId) });
    const assignerName = assigner
      ? `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim()
      : 'Someone';

    return createNotification({
      userId: assigneeId,
      type: 'issue_assigned',
      title: `Issue Assigned: ${issue.issueKey || issue.title}`,
      message: `${assignerName} assigned you the issue "${issue.title}".`,
      relatedEntityType: 'issue',
      relatedEntityId: issueId,
      metadata: { assignedBy: assignerId, assignedByName: assignerName },
    });
  } catch (err) {
    console.error('notifyIssueAssigned error:', err);
    return null;
  }
};

/**
 * Notify issue assignee and creator when a comment is added to an issue (Req 4.2).
 * Excludes the commenter from notifications.
 */
export const notifyIssueCommentAdded = async (
  issueId: string,
  commenterId: string,
  commentBody: string
) => {
  try {
    const issues = await database.getCollection('issues');
    const users = await database.getCollection('users');

    const issue = await issues.findOne({ _id: toObjectId(issueId) });
    if (!issue) return [];

    const commenter = await users.findOne({ _id: toObjectId(commenterId) });
    const commenterName = commenter
      ? `${commenter.firstName || ''} ${commenter.lastName || ''}`.trim()
      : 'Someone';

    const recipientIds = new Set<string>();
    if (issue.assignedTo && issue.assignedTo !== commenterId) {
      recipientIds.add(issue.assignedTo);
    }
    if (issue.createdBy && issue.createdBy !== commenterId) {
      recipientIds.add(issue.createdBy);
    }

    const notifications = [];
    for (const recipientId of recipientIds) {
      try {
        const notif = await createNotification({
          userId: recipientId,
          type: 'comment_added',
          title: `New Comment on ${issue.issueKey || issue.title}`,
          message: `${commenterName} commented on "${issue.title}": ${commentBody.substring(0, 100)}${commentBody.length > 100 ? '...' : ''}`,
          relatedEntityType: 'issue',
          relatedEntityId: issueId,
          metadata: { commenterId, commenterName },
        });
        notifications.push(notif);
      } catch (err) {
        console.error(`notifyIssueCommentAdded: failed for recipient ${recipientId}:`, err);
      }
    }
    return notifications;
  } catch (err) {
    console.error('notifyIssueCommentAdded error:', err);
    return [];
  }
};

/**
 * Parse @username tokens from a comment body and create mention notifications (Req 4.5).
 * Excludes the commenter from being notified of their own mention.
 */
export const notifyMentions = async (
  commentBody: string,
  issueId: string,
  commenterId: string
) => {
  try {
    // Extract all @username tokens (alphanumeric + underscore)
    const mentionRegex = /@([\w]+)/g;
    const usernames: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(commentBody)) !== null) {
      usernames.push(match[1]);
    }

    if (!usernames.length) return [];

    const users = await database.getCollection('users');
    const issues = await database.getCollection('issues');

    const issue = await issues.findOne({ _id: toObjectId(issueId) });
    const issueTitle = issue?.title || issueId;
    const issueKey = issue?.issueKey || issueId;

    const commenter = await users.findOne({ _id: toObjectId(commenterId) });
    const commenterName = commenter
      ? `${commenter.firstName || ''} ${commenter.lastName || ''}`.trim()
      : 'Someone';

    const notifications = [];
    const notifiedUserIds = new Set<string>();

    for (const username of usernames) {
      // Look up user by email prefix or firstName match — use email local part
      const userDoc = await users.findOne({
        $or: [
          { email: new RegExp(`^${username}@`, 'i') },
          { firstName: new RegExp(`^${username}$`, 'i') },
        ],
        isActive: true,
      });

      if (!userDoc) continue;

      const mentionedUserId = normalizeId(userDoc._id);
      // Skip commenter and already-notified users
      if (mentionedUserId === commenterId) continue;
      if (notifiedUserIds.has(mentionedUserId)) continue;
      notifiedUserIds.add(mentionedUserId);

      try {
        const notif = await createNotification({
          userId: mentionedUserId,
          type: 'mention',
          title: `You were mentioned in ${issueKey}`,
          message: `${commenterName} mentioned you in "${issueTitle}": ${commentBody.substring(0, 100)}${commentBody.length > 100 ? '...' : ''}`,
          relatedEntityType: 'issue',
          relatedEntityId: issueId,
          metadata: { mentionedBy: commenterId, mentionedByName: commenterName, username },
        });
        notifications.push(notif);
      } catch (err) {
        console.error(`notifyMentions: failed for user ${mentionedUserId}:`, err);
      }
    }

    return notifications;
  } catch (err) {
    console.error('notifyMentions error:', err);
    return [];
  }
};

/**
 * Notify all project members when a sprint starts (Req 4.3).
 * Fan-out via notifyProjectMembers; Socket.IO emission wrapped in try/catch.
 */
export const notifySprintStarted = async (sprintId: string, projectId: string, sprintName: string) => {
  try {
    return await notifyProjectMembers(projectId, {
      type: 'sprint_started',
      title: `Sprint Started: ${sprintName}`,
      message: `Sprint "${sprintName}" has been started.`,
      relatedEntityType: 'sprint',
      relatedEntityId: sprintId,
    });
  } catch (err) {
    console.error('notifySprintStarted error:', err);
    return [];
  }
};

/**
 * Notify all project members when a sprint closes (Req 4.4).
 */
export const notifySprintClosed = async (
  sprintId: string,
  projectId: string,
  sprintName: string,
  completedIssueCount: number
) => {
  try {
    return await notifyProjectMembers(projectId, {
      type: 'sprint_closed',
      title: `Sprint Closed: ${sprintName}`,
      message: `Sprint "${sprintName}" has been closed. ${completedIssueCount} issues completed.`,
      relatedEntityType: 'sprint',
      relatedEntityId: sprintId,
    });
  } catch (err) {
    console.error('notifySprintClosed error:', err);
    return [];
  }
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
