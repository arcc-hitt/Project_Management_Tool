import searchService from '../services/searchService.js';
import { validationResult } from 'express-validator';

class SearchController {
  async unifiedSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { query, page = 1, limit = 20 } = req.query;
      const userId = req.user.id;

      const results = await searchService.unifiedSearch({
        query,
        page: parseInt(page),
        limit: parseInt(limit),
        userId
      });

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('Unified search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during search'
      });
    }
  }

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

      const { query, limit = 10 } = req.query;
      const userId = req.user.id;

      const projects = await searchService.searchProjects({
        query,
        limit: parseInt(limit),
        userId
      });

      res.json({
        success: true,
        data: projects
      });

    } catch (error) {
      console.error('Project search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during project search'
      });
    }
  }

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

      const { query, limit = 10 } = req.query;
      const userId = req.user.id;

      const tasks = await searchService.searchTasks({
        query,
        limit: parseInt(limit),
        userId
      });

      res.json({
        success: true,
        data: tasks
      });

    } catch (error) {
      console.error('Task search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during task search'
      });
    }
  }

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

      const { query, limit = 10 } = req.query;

      const users = await searchService.searchUsers({
        query,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      console.error('User search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during user search'
      });
    }
  }

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

      const { query, limit = 10 } = req.query;
      const userId = req.user.id;

      const comments = await searchService.searchComments({
        query,
        limit: parseInt(limit),
        userId
      });

      res.json({
        success: true,
        data: comments
      });

    } catch (error) {
      console.error('Comment search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during comment search'
      });
    }
  }

  async getSearchSuggestions(req, res) {
    try {
      const { query, limit = 5 } = req.query;

      const suggestions = await searchService.getSearchSuggestions({
        query,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting search suggestions'
      });
    }
  }

  async getFilterOptions(req, res) {
    try {
      const userId = req.user.id;

      const filterOptions = await searchService.getFilterOptions(userId);

      res.json({
        success: true,
        data: filterOptions
      });

    } catch (error) {
      console.error('Filter options error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting filter options'
      });
    }
  }

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

      // For now, just redirect to unified search
      return this.unifiedSearch(req, res);

    } catch (error) {
      console.error('Advanced search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during advanced search'
      });
    }
  }
}

export default new SearchController();
