import { param, query } from 'express-validator';

export const dashboardQueryValidation = [
  query('dateRange')
    .optional()
    .isIn(['7', '14', '30', '60', '90'])
    .withMessage('Date range must be 7, 14, 30, 60, or 90 days'),

  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

export const projectStatsValidation = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  query('dateRange')
    .optional()
    .isIn(['7', '14', '30', '60', '90'])
    .withMessage('Date range must be 7, 14, 30, 60, or 90 days')
];

export const exportValidation = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv'),

  query('dateRange')
    .optional()
    .isIn(['7', '14', '30', '60', '90'])
    .withMessage('Date range must be 7, 14, 30, 60, or 90 days'),

  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

export const teamPerformanceValidation = [
  query('dateRange')
    .optional()
    .isIn(['7', '14', '30', '60', '90'])
    .withMessage('Date range must be 7, 14, 30, 60, or 90 days'),

  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

export const systemAnalyticsValidation = [
  query('dateRange')
    .optional()
    .isIn(['7', '14', '30', '60', '90'])
    .withMessage('Date range must be 7, 14, 30, 60, or 90 days')
];