// Model exports for the Project Management Tool
// This file centralizes all model imports for easy access throughout the application

import User from './User.js';
import Project from './Project.js';
import Issue from './Issue.js';
import Sprint from './Sprint.js';
import Comment from './Comment.js';
import Notification from './Notification.js';
import ActivityLog from './ActivityLog.js';
import TimeEntry from './TimeEntry.js';
import ProjectMember from './ProjectMember.js';

// Task is an alias for Issue for backward compatibility
const Task = Issue;

export {
  User,
  Project,
  Issue,
  Task,
  Sprint,
  Comment,
  Notification,
  ActivityLog,
  TimeEntry,
  ProjectMember
};

export default {
  User,
  Project,
  Issue,
  Task,
  Sprint,
  Comment,
  Notification,
  ActivityLog,
  TimeEntry,
  ProjectMember
};
