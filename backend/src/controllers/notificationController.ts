import { validationResult } from 'express-validator';
import asyncHandler from 'express-async-handler';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { createNotification } from '../utils/notificationUtils.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { page = 1, limit = 20, isRead, type } = req.query;
  const userId = req.user.id;
  const parsedLimit = parseInt(String(limit), 10);
  const parsedPage = parseInt(String(page), 10);
  const offset = (parsedPage - 1) * parsedLimit;

  const options: Record<string, any> = { limit: parsedLimit, offset, type: type ? String(type) : undefined };
  if (isRead !== undefined) {
    options.isRead = String(isRead) === 'true';
  }

  const [notifications, total] = await Promise.all([
    Notification.findByUser(userId, options),
    Notification.count({ userId, type: type ? String(type) : undefined, ...(isRead !== undefined ? { isRead: String(isRead) === 'true' } : {}) }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      total,
      currentPage: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
      hasMore: offset + notifications.length < total,
    },
    message: 'Notifications retrieved successfully',
  });
});

export const getNotificationById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const userId = req.user.id;
  const notification = await Notification.findById(id);

  if (!notification || notification.userId !== userId) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }

  res.status(200).json({
    success: true,
    data: { notification },
    message: 'Notification retrieved successfully',
  });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const userId = req.user.id;
  const notification = await Notification.findById(id);

  if (!notification || notification.userId !== userId) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }

  await Notification.markAsRead(id);
  res.status(200).json({ success: true, message: 'Notification marked as read' });
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const updatedCount = await Notification.markAllAsRead(userId);
  res.status(200).json({ success: true, data: { updatedCount }, message: 'All notifications marked as read' });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const userId = req.user.id;
  const notification = await Notification.findById(id);

  if (!notification || notification.userId !== userId) {
    res.status(404).json({ success: false, message: 'Notification not found' });
    return;
  }

  await Notification.delete(id);
  res.status(200).json({ success: true, message: 'Notification deleted successfully' });
});

export const getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const all = await Notification.findByUser(userId, { limit: 1000 });
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const byType = all.reduce((acc, notification) => {
    const key = notification.type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const stats = {
    total: all.length,
    unread: all.filter((n) => !n.isRead).length,
    read: all.filter((n) => n.isRead).length,
    byType,
    task_notifications: all.filter((n) => n.type === 'task').length,
    project_notifications: all.filter((n) => n.type === 'project').length,
    deadline_notifications: all.filter((n) => n.type === 'deadline').length,
    mention_notifications: all.filter((n) => n.type === 'mention').length,
    today: all.filter((n) => n.createdAt && new Date(n.createdAt) >= dayAgo).length,
  };

  res.status(200).json({
    success: true,
    data: stats,
    message: 'Notification statistics retrieved successfully',
  });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const unread = await Notification.count({ userId, isRead: false });

  res.status(200).json({
    success: true,
    data: { count: unread },
    message: 'Unread notification count retrieved successfully',
  });
});

export const bulkMarkAsRead = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { notificationIds } = req.body;
  const userId = req.user.id;

  let updatedCount = 0;
  for (const id of notificationIds) {
    const n = await Notification.findById(id);
    if (n && n.userId === userId && !n.isRead) {
      await Notification.markAsRead(id);
      updatedCount += 1;
    }
  }

  res.status(200).json({ success: true, data: { updatedCount }, message: 'Notifications marked as read' });
});

export const bulkDelete = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
    return;
  }

  const { notificationIds } = req.body;
  const userId = req.user.id;

  let deletedCount = 0;
  for (const id of notificationIds) {
    const n = await Notification.findById(id);
    if (n && n.userId === userId) {
      await Notification.delete(id);
      deletedCount += 1;
    }
  }

  res.status(200).json({ success: true, data: { deletedCount }, message: 'Notifications deleted successfully' });
});

export const cleanupOldNotifications = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const deletedCount = await Notification.deleteOld(Number(days));

  res.status(200).json({
    success: true,
    data: { deletedCount },
    message: `Cleaned up notifications older than ${days} days`,
  });
});

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const preferences = {
    email: user.emailNotifications ?? true,
    push: user.pushNotifications ?? false,
    inApp: user.inAppNotifications ?? true,
    task: user.taskNotifications ?? true,
    project: user.projectNotifications ?? true,
    deadline: user.deadlineNotifications ?? true,
    mention: user.mentionNotifications ?? true,
  };

  res.status(200).json({ success: true, data: { preferences }, message: 'Notification preferences retrieved successfully' });
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { email, push, inApp, task, project, deadline, mention } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  await User.update(userId, {
    emailNotifications: email,
    pushNotifications: push,
    inAppNotifications: inApp,
    taskNotifications: task,
    projectNotifications: project,
    deadlineNotifications: deadline,
    mentionNotifications: mention,
  });

  res.status(200).json({ success: true, message: 'Notification preferences updated successfully' });
});

export const testNotification = asyncHandler(async (req, res) => {
  const { type = 'test' } = req.body;
  const userId = req.user.id;

  await createNotification({
    userId,
    type: 'test',
    title: 'Test Notification',
    message: `This is a test ${type} notification.`,
    relatedEntityType: null,
    relatedEntityId: null,
  });

  res.status(200).json({ success: true, message: 'Test notification sent successfully' });
});
