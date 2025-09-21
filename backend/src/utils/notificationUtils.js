import db from '../config/database.js';
import { EventEmitter } from 'events';

// Event emitter for real-time notifications
export const notificationEmitter = new EventEmitter();

/**
 * Create a new notification
 * @param {Object} params - Notification parameters
 * @param {number} params.userId - User ID to receive the notification
 * @param {string} params.type - Type of notification
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.relatedEntityType] - Type of related entity (project, task, etc.)
 * @param {number} [params.relatedEntityId] - ID of related entity
 * @param {Object} [params.metadata] - Additional metadata
 */
export const createNotification = async ({
  userId,
  type,
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  metadata = null
}) => {
  try {
    const query = `
      INSERT INTO notifications (
        user_id, type, title, message, 
        related_entity_type, related_entity_id, 
        metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.execute(query, [
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      metadata ? JSON.stringify(metadata) : null
    ]);

    const notificationId = result.insertId;

    // Fetch the created notification with related entity names
    const fetchQuery = `
      SELECT n.*, 
             CASE 
               WHEN n.related_entity_type = 'project' THEN p.name
               WHEN n.related_entity_type = 'task' THEN t.title
               ELSE null
             END as related_entity_name
      FROM notifications n
      LEFT JOIN projects p ON n.related_entity_type = 'project' AND n.related_entity_id = p.id
      LEFT JOIN tasks t ON n.related_entity_type = 'task' AND t.id = n.related_entity_id
      WHERE n.id = ?
    `;

    const [notifications] = await db.execute(fetchQuery, [notificationId]);
    const notification = notifications[0];

    // Emit real-time notification event
    notificationEmitter.emit('notification', {
      userId,
      notification
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create notifications for multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data
 */
export const createBulkNotifications = async (userIds, notificationData) => {
  try {
    const promises = userIds.map(userId =>
      createNotification({
        userId,
        ...notificationData
      })
    );

    return await Promise.all(promises);
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};

/**
 * Create notification for project members
 * @param {number} projectId - Project ID
 * @param {Object} notificationData - Notification data
 * @param {number} [excludeUserId] - User ID to exclude from notifications
 */
export const notifyProjectMembers = async (projectId, notificationData, excludeUserId = null) => {
  try {
    let query = `
      SELECT DISTINCT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = ?
    `;
    
    const queryParams = [projectId];
    
    if (excludeUserId) {
      query += ' AND pm.user_id != ?';
      queryParams.push(excludeUserId);
    }

    const [members] = await db.execute(query, queryParams);
    const userIds = members.map(member => member.user_id);

    if (userIds.length > 0) {
      return await createBulkNotifications(userIds, {
        ...notificationData,
        relatedEntityType: 'project',
        relatedEntityId: projectId
      });
    }

    return [];
  } catch (error) {
    console.error('Error notifying project members:', error);
    throw error;
  }
};

/**
 * Create notification for task assignees
 * @param {number} taskId - Task ID
 * @param {Object} notificationData - Notification data
 * @param {number} [excludeUserId] - User ID to exclude from notifications
 */
export const notifyTaskAssignees = async (taskId, notificationData, excludeUserId = null) => {
  try {
    let query = `
      SELECT DISTINCT ta.user_id
      FROM task_assignments ta
      WHERE ta.task_id = ?
    `;
    
    const queryParams = [taskId];
    
    if (excludeUserId) {
      query += ' AND ta.user_id != ?';
      queryParams.push(excludeUserId);
    }

    const [assignees] = await db.execute(query, queryParams);
    const userIds = assignees.map(assignee => assignee.user_id);

    if (userIds.length > 0) {
      return await createBulkNotifications(userIds, {
        ...notificationData,
        relatedEntityType: 'task',
        relatedEntityId: taskId
      });
    }

    return [];
  } catch (error) {
    console.error('Error notifying task assignees:', error);
    throw error;
  }
};

/**
 * Create deadline reminder notifications
 * @param {string} entityType - Type of entity (task, project)
 * @param {number} entityId - Entity ID
 * @param {Date} deadline - Deadline date
 * @param {number} reminderHours - Hours before deadline to remind
 */
export const createDeadlineReminder = async (entityType, entityId, deadline, reminderHours = 24) => {
  try {
    const reminderTime = new Date(deadline.getTime() - (reminderHours * 60 * 60 * 1000));
    
    if (reminderTime <= new Date()) {
      return; // Don't create reminders for past deadlines
    }

    let query, entityName, userIds;

    if (entityType === 'task') {
      // Get task details and assignees
      const taskQuery = `
        SELECT t.title, ta.user_id
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.id = ta.task_id
        WHERE t.id = ?
      `;
      const [taskData] = await db.execute(taskQuery, [entityId]);
      
      if (taskData.length === 0) return;
      
      entityName = taskData[0].title;
      userIds = taskData.map(row => row.user_id).filter(Boolean);
    } else if (entityType === 'project') {
      // Get project details and members
      const projectQuery = `
        SELECT p.name, pm.user_id
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = ?
      `;
      const [projectData] = await db.execute(projectQuery, [entityId]);
      
      if (projectData.length === 0) return;
      
      entityName = projectData[0].name;
      userIds = projectData.map(row => row.user_id).filter(Boolean);
    }

    if (userIds.length > 0) {
      return await createBulkNotifications(userIds, {
        type: 'deadline',
        title: `Deadline Reminder: ${entityName}`,
        message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} "${entityName}" is due in ${reminderHours} hours.`,
        relatedEntityType: entityType,
        relatedEntityId: entityId,
        metadata: {
          deadline: deadline.toISOString(),
          reminderHours
        }
      });
    }
  } catch (error) {
    console.error('Error creating deadline reminder:', error);
    throw error;
  }
};

/**
 * Create mention notification
 * @param {number} mentionedUserId - ID of mentioned user
 * @param {number} mentionedByUserId - ID of user who mentioned
 * @param {string} context - Context where mention occurred
 * @param {string} entityType - Type of entity where mention occurred
 * @param {number} entityId - ID of entity where mention occurred
 */
export const createMentionNotification = async (
  mentionedUserId,
  mentionedByUserId,
  context,
  entityType,
  entityId
) => {
  try {
    // Get the name of user who mentioned
    const userQuery = 'SELECT first_name, last_name FROM users WHERE id = ?';
    const [users] = await db.execute(userQuery, [mentionedByUserId]);
    
    if (users.length === 0) return;
    
    const mentionedByName = `${users[0].first_name} ${users[0].last_name}`;

    return await createNotification({
      userId: mentionedUserId,
      type: 'mention',
      title: `You were mentioned by ${mentionedByName}`,
      message: context,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      metadata: {
        mentionedBy: mentionedByUserId,
        mentionedByName
      }
    });
  } catch (error) {
    console.error('Error creating mention notification:', error);
    throw error;
  }
};

/**
 * Check for upcoming deadlines and create reminders
 */
export const checkUpcomingDeadlines = async () => {
  try {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    const next72Hours = new Date(now.getTime() + (72 * 60 * 60 * 1000));

    // Check for task deadlines
    const taskQuery = `
      SELECT id, title, due_date
      FROM tasks
      WHERE due_date BETWEEN ? AND ?
      AND status != 'completed'
    `;
    
    const [tasks] = await db.execute(taskQuery, [now, next72Hours]);

    // Check for project deadlines
    const projectQuery = `
      SELECT id, name, end_date
      FROM projects
      WHERE end_date BETWEEN ? AND ?
      AND status != 'completed'
    `;
    
    const [projects] = await db.execute(projectQuery, [now, next72Hours]);

    // Create reminders for tasks
    for (const task of tasks) {
      const hoursUntilDeadline = Math.ceil((new Date(task.due_date) - now) / (1000 * 60 * 60));
      
      if (hoursUntilDeadline <= 24) {
        await createDeadlineReminder('task', task.id, new Date(task.due_date), hoursUntilDeadline);
      } else if (hoursUntilDeadline <= 72) {
        await createDeadlineReminder('task', task.id, new Date(task.due_date), 72);
      }
    }

    // Create reminders for projects
    for (const project of projects) {
      const hoursUntilDeadline = Math.ceil((new Date(project.end_date) - now) / (1000 * 60 * 60));
      
      if (hoursUntilDeadline <= 24) {
        await createDeadlineReminder('project', project.id, new Date(project.end_date), hoursUntilDeadline);
      } else if (hoursUntilDeadline <= 72) {
        await createDeadlineReminder('project', project.id, new Date(project.end_date), 72);
      }
    }

    console.log(`Checked ${tasks.length} tasks and ${projects.length} projects for upcoming deadlines`);
  } catch (error) {
    console.error('Error checking upcoming deadlines:', error);
  }
};

/**
 * Schedule deadline reminders (to be called by cron job)
 */
export const scheduleDeadlineReminders = () => {
  // Run every hour
  setInterval(checkUpcomingDeadlines, 60 * 60 * 1000);
  
  // Run immediately on startup
  checkUpcomingDeadlines();
};

/**
 * Get notification template
 * @param {string} type - Notification type
 * @param {Object} data - Template data
 */
export const getNotificationTemplate = (type, data) => {
  const templates = {
    task_assigned: {
      title: `New Task Assigned: ${data.taskTitle}`,
      message: `You have been assigned to the task "${data.taskTitle}" in project "${data.projectName}".`
    },
    task_completed: {
      title: `Task Completed: ${data.taskTitle}`,
      message: `The task "${data.taskTitle}" has been marked as completed by ${data.completedBy}.`
    },
    task_updated: {
      title: `Task Updated: ${data.taskTitle}`,
      message: `The task "${data.taskTitle}" has been updated by ${data.updatedBy}.`
    },
    project_created: {
      title: `New Project: ${data.projectName}`,
      message: `You have been added to the project "${data.projectName}".`
    },
    project_updated: {
      title: `Project Updated: ${data.projectName}`,
      message: `The project "${data.projectName}" has been updated by ${data.updatedBy}.`
    },
    deadline_reminder: {
      title: `Deadline Reminder: ${data.entityName}`,
      message: `${data.entityType} "${data.entityName}" is due soon.`
    },
    comment_added: {
      title: `New Comment: ${data.entityName}`,
      message: `${data.commenterName} added a comment to "${data.entityName}".`
    }
  };

  return templates[type] || {
    title: 'Notification',
    message: 'You have a new notification.'
  };
};