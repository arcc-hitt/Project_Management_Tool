import searchService from '../services/searchService.js';
import { validationResult } from 'express-validator';

class SearchController {
  /**
   * Perform unified search across multiple entity types
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async unifiedSearch(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        types = ['projects', 'tasks', 'users', 'comments'],
        status,
        priority,
        projectId,
        assigneeId,
        role,
        startDate,
        endDate,
        dueDate,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 10
      } = req.query;

      const userId = req.user.id;
      const offset = (page - 1) * limit;

      const filters = {
        status,
        priority,
        projectId: projectId ? parseInt(projectId) : undefined,
        assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
        role,
        startDate,
        endDate,
        dueDate,
        sortBy,
        sortOrder
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const searchTypes = Array.isArray(types) ? types : [types];
      const results = await searchService.unifiedSearch({
        query,
        types: searchTypes,
        filters,
        pagination: { limit: parseInt(limit), offset },
        userId
      });

      res.json({
        success: true,
        message: 'Search completed successfully',
        data: results
      });
    } catch (error) {
      console.error('Unified search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform search',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search projects specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchProjects(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        status,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 10
      } = req.query;

      const userId = req.user.id;
      const offset = (page - 1) * limit;

      const filters = {
        status,
        startDate,
        endDate,
        sortBy,
        sortOrder
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const results = await searchService.searchProjects({
        query,
        filters,
        pagination: { limit: parseInt(limit), offset },
        userId
      });

      res.json({
        success: true,
        message: 'Project search completed successfully',
        data: results
      });
    } catch (error) {
      console.error('Project search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search projects',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search tasks specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchTasks(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        status,
        priority,
        projectId,
        assigneeId,
        dueDate,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 10
      } = req.query;

      const userId = req.user.id;
      const offset = (page - 1) * limit;

      const filters = {
        status,
        priority,
        projectId: projectId ? parseInt(projectId) : undefined,
        assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
        dueDate,
        sortBy,
        sortOrder
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const results = await searchService.searchTasks({
        query,
        filters,
        pagination: { limit: parseInt(limit), offset },
        userId
      });

      res.json({
        success: true,
        message: 'Task search completed successfully',
        data: results
      });
    } catch (error) {
      console.error('Task search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search tasks',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search users specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchUsers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        role,
        sortBy = 'firstName',
        sortOrder = 'ASC',
        page = 1,
        limit = 10
      } = req.query;

      const userId = req.user.id;
      const offset = (page - 1) * limit;

      const filters = {
        role,
        sortBy,
        sortOrder
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const results = await searchService.searchUsers({
        query,
        filters,
        pagination: { limit: parseInt(limit), offset },
        userId
      });

      res.json({
        success: true,
        message: 'User search completed successfully',
        data: results
      });
    } catch (error) {
      console.error('User search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search comments specifically
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchComments(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        projectId,
        taskId,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 10
      } = req.query;

      const userId = req.user.id;
      const offset = (page - 1) * limit;

      const filters = {
        projectId: projectId ? parseInt(projectId) : undefined,
        taskId: taskId ? parseInt(taskId) : undefined,
        sortBy,
        sortOrder
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const results = await searchService.searchComments({
        query,
        filters,
        pagination: { limit: parseInt(limit), offset },
        userId
      });

      res.json({
        success: true,
        message: 'Comment search completed successfully',
        data: results
      });
    } catch (error) {
      console.error('Comment search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search comments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get search suggestions for autocomplete
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSearchSuggestions(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        query, 
        types = ['projects', 'tasks', 'users'] 
      } = req.query;

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          message: 'Query too short for suggestions',
          data: { suggestions: {} }
        });
      }

      const userId = req.user.id;
      const searchTypes = Array.isArray(types) ? types : [types];

      const results = await searchService.getSearchSuggestions({
        query,
        types: searchTypes,
        userId
      });

      res.json({
        success: true,
        message: 'Search suggestions retrieved successfully',
        data: results
      });
    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search suggestions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get available filter options for advanced search
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getFilterOptions(req, res) {
    try {
      const userId = req.user.id;

      const results = await searchService.getFilterOptions(userId);

      res.json({
        success: true,
        message: 'Filter options retrieved successfully',
        data: results
      });
    } catch (error) {
      console.error('Filter options error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get filter options',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Advanced search with multiple criteria
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async advancedSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const searchCriteria = req.body;
      const userId = req.user.id;

      // Process each search type in the criteria
      const results = {};
      
      if (searchCriteria.projects) {
        results.projects = await searchService.searchProjects({
          ...searchCriteria.projects,
          userId
        });
      }

      if (searchCriteria.tasks) {
        results.tasks = await searchService.searchTasks({
          ...searchCriteria.tasks,
          userId
        });
      }

      if (searchCriteria.users) {
        results.users = await searchService.searchUsers({
          ...searchCriteria.users,
          userId
        });
      }

      if (searchCriteria.comments) {
        results.comments = await searchService.searchComments({
          ...searchCriteria.comments,
          userId
        });
      }

      res.json({
        success: true,
        message: 'Advanced search completed successfully',
        data: {
          results,
          criteria: searchCriteria
        }
      });
    } catch (error) {
      console.error('Advanced search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform advanced search',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default new SearchController();