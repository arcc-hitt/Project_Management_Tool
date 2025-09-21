import { validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import db from '../config/database.js';
import { createNotification } from '../utils/notificationUtils.js';

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { page = 1, limit = 20, isRead, type } = req.query;
  const offset = (page - 1) * limit;
  const userId = req.user.id;

  try {
    let whereClause = 'WHERE user_id = ?';
    let queryParams = [userId];

    if (isRead !== undefined) {
      whereClause += ' AND is_read = ?';
      queryParams.push(isRead === 'true');
    }

    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }

    const query = `
      SELECT n.*, 
             CASE 
               WHEN n.related_entity_type = 'project' THEN p.name
               WHEN n.related_entity_type = 'task' THEN t.title
               ELSE null
             END as related_entity_name
      FROM notifications n
      LEFT JOIN projects p ON n.related_entity_type = 'project' AND n.related_entity_id = p.id
      LEFT JOIN tasks t ON n.related_entity_type = 'task' AND t.id = n.related_entity_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      ${whereClause}
    `;

    const [notifications] = await db.execute(query, [...queryParams, parseInt(limit), offset]);
    const [countResult] = await db.execute(countQuery, queryParams);
    const total = countResult[0].total;

    res.status(200).json({
      success: true,
      data: {
        notifications,
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasMore: offset + notifications.length < total
      },
      message: 'Notifications retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Get notification by ID
 * @route   GET /api/notifications/:id
 * @access  Private
 */
export const getNotificationById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const userId = req.user.id;

  try {
    const query = `
      SELECT n.*, 
             CASE 
               WHEN n.related_entity_type = 'project' THEN p.name
               WHEN n.related_entity_type = 'task' THEN t.title
               ELSE null
             END as related_entity_name
      FROM notifications n
      LEFT JOIN projects p ON n.related_entity_type = 'project' AND n.related_entity_id = p.id
      LEFT JOIN tasks t ON n.related_entity_type = 'task' AND t.id = n.related_entity_id
      WHERE n.id = ? AND n.user_id = ?
    `;

    const [notifications] = await db.execute(query, [id, userId]);

    if (!notifications.length) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { notification: notifications[0] },
      message: 'Notification retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const userId = req.user.id;

  try {
    const query = 'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = ? AND user_id = ?';
    const [result] = await db.execute(query, [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/mark-all-read
 * @access  Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const query = 'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = ? AND is_read = false';
    const [result] = await db.execute(query, [userId]);

    res.status(200).json({
      success: true,
      data: { updatedCount: result.affectedRows },
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const userId = req.user.id;

  try {
    const query = 'DELETE FROM notifications WHERE id = ? AND user_id = ?';
    const [result] = await db.execute(query, [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Get notification statistics
 * @route   GET /api/notifications/stats
 * @access  Private
 */
export const getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read,
        COUNT(CASE WHEN type = 'task' THEN 1 END) as task_notifications,
        COUNT(CASE WHEN type = 'project' THEN 1 END) as project_notifications,
        COUNT(CASE WHEN type = 'deadline' THEN 1 END) as deadline_notifications,
        COUNT(CASE WHEN type = 'mention' THEN 1 END) as mention_notifications,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as today
      FROM notifications 
      WHERE user_id = ?
    `;

    const [stats] = await db.execute(statsQuery, [userId]);

    res.status(200).json({
      success: true,
      data: { stats: stats[0] },
      message: 'Notification statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Mark multiple notifications as read
 * @route   PATCH /api/notifications/bulk-read
 * @access  Private
 */
export const bulkMarkAsRead = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { notificationIds } = req.body;
  const userId = req.user.id;

  try {
    const placeholders = notificationIds.map(() => '?').join(',');
    const query = `
      UPDATE notifications 
      SET is_read = true, read_at = NOW() 
      WHERE id IN (${placeholders}) AND user_id = ?
    `;

    const [result] = await db.execute(query, [...notificationIds, userId]);

    res.status(200).json({
      success: true,
      data: { updatedCount: result.affectedRows },
      message: 'Notifications marked as read'
    });
  } catch (error) {
    console.error('Error bulk marking notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Delete multiple notifications
 * @route   DELETE /api/notifications/bulk-delete
 * @access  Private
 */
export const bulkDelete = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }

  const { notificationIds } = req.body;
  const userId = req.user.id;

  try {
    const placeholders = notificationIds.map(() => '?').join(',');
    const query = `DELETE FROM notifications WHERE id IN (${placeholders}) AND user_id = ?`;

    const [result] = await db.execute(query, [...notificationIds, userId]);

    res.status(200).json({
      success: true,
      data: { deletedCount: result.affectedRows },
      message: 'Notifications deleted successfully'
    });
  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Clean up old notifications
 * @route   DELETE /api/notifications/cleanup
 * @access  Admin
 */
export const cleanupOldNotifications = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  try {
    const query = `
      DELETE FROM notifications 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) 
      AND is_read = true
    `;

    const [result] = await db.execute(query, [days]);

    res.status(200).json({
      success: true,
      data: { deletedCount: result.affectedRows },
      message: `Cleaned up notifications older than ${days} days`
    });
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Get notification preferences
 * @route   GET /api/notifications/preferences
 * @access  Private
 */
export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT email_notifications, push_notifications, in_app_notifications,
             task_notifications, project_notifications, deadline_notifications,
             mention_notifications
      FROM users 
      WHERE id = ?
    `;

    const [users] = await db.execute(query, [userId]);

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const preferences = {
      email: users[0].email_notifications,
      push: users[0].push_notifications,
      inApp: users[0].in_app_notifications,
      task: users[0].task_notifications,
      project: users[0].project_notifications,
      deadline: users[0].deadline_notifications,
      mention: users[0].mention_notifications
    };

    res.status(200).json({
      success: true,
      data: { preferences },
      message: 'Notification preferences retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Update notification preferences
 * @route   PUT /api/notifications/preferences
 * @access  Private
 */
export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    email,
    push,
    inApp,
    task,
    project,
    deadline,
    mention
  } = req.body;

  try {
    const query = `
      UPDATE users 
      SET email_notifications = ?, 
          push_notifications = ?, 
          in_app_notifications = ?,
          task_notifications = ?,
          project_notifications = ?,
          deadline_notifications = ?,
          mention_notifications = ?
      WHERE id = ?
    `;

    const [result] = await db.execute(query, [
      email, push, inApp, task, project, deadline, mention, userId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @desc    Test notification sending
 * @route   POST /api/notifications/test
 * @access  Private
 */
export const testNotification = asyncHandler(async (req, res) => {
  const { type = 'test' } = req.body;
  const userId = req.user.id;

  try {
    await createNotification({
      userId,
      type: 'test',
      title: 'Test Notification',
      message: `This is a test ${type} notification.`,
      relatedEntityType: null,
      relatedEntityId: null
    });

    res.status(200).json({
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});