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
        page: parseInt(String(page), 10),
        limit: parseInt(String(limit), 10),
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
        limit: parseInt(String(limit), 10),
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
        limit: parseInt(String(limit), 10),
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
        limit: parseInt(String(limit), 10)
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
        limit: parseInt(String(limit), 10),
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
        limit: parseInt(String(limit), 10)
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

  async searchIssues(req, res) {
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
        page = 1,
        limit = 25,
        issueType,
        status,
        priority,
        assigneeId,
        projectId,
        sprintId,
        label,
        componentId,
        bugSeverity,
        versionId,
        epicId,
        storyPointsMin,
        storyPointsMax,
        createdAtFrom,
        createdAtTo,
        updatedAtFrom,
        updatedAtTo,
        dueDateFrom,
        dueDateTo,
      } = req.query;

      const result = await searchService.searchIssues({
        query,
        page: parseInt(String(page), 10),
        limit: parseInt(String(limit), 10),
        issueType,
        status,
        priority,
        assigneeId,
        projectId,
        sprintId,
        label,
        componentId,
        bugSeverity,
        versionId,
        epicId,
        storyPointsMin,
        storyPointsMax,
        createdAtFrom,
        createdAtTo,
        updatedAtFrom,
        updatedAtTo,
        dueDateFrom,
        dueDateTo,
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Issue search error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during issue search'
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

  async saveFilter(req, res) {
    try {
      const { name, criteria } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      if (!name || !criteria) {
        return res.status(400).json({ success: false, message: 'name and criteria are required' });
      }
      const filter = await searchService.saveFilter(userId, name, criteria, organizationId);
      res.status(201).json({ success: true, data: filter });
    } catch (error) {
      console.error('Save filter error:', error);
      res.status(500).json({ success: false, message: 'Internal server error saving filter' });
    }
  }

  async listFilters(req, res) {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      const filters = await searchService.listFilters(userId, organizationId);
      res.json({ success: true, data: filters });
    } catch (error) {
      console.error('List filters error:', error);
      res.status(500).json({ success: false, message: 'Internal server error listing filters' });
    }
  }

  async runFilter(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await searchService.runFilter(id, userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
      if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
      console.error('Run filter error:', error);
      res.status(500).json({ success: false, message: 'Internal server error running filter' });
    }
  }

  async deleteFilter(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      await searchService.deleteFilter(id, userId);
      res.status(204).send();
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
      if (error.status === 404) return res.status(404).json({ success: false, message: error.message });
      console.error('Delete filter error:', error);
      res.status(500).json({ success: false, message: 'Internal server error deleting filter' });
    }
  }
}

export default new SearchController();
