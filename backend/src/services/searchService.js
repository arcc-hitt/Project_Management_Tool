import database from '../config/database.js';
import { snakeToCamel } from '../utils/helpers.js';

class SearchService {
  /**
   * Unified search across multiple entities
   */
  async unifiedSearch(options = {}) {
    const { query = '', page = 1, limit = 20, userId } = options;
    
    try {
      if (!query || query.trim().length === 0) {
        return {
          projects: [],
          tasks: [],
          users: [],
          comments: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: page,
            itemsPerPage: limit
          }
        };
      }

      // Search projects
      const projects = await this.searchProjects({ query, userId, limit: 5 });
      
      // Search tasks  
      const tasks = await this.searchTasks({ query, userId, limit: 5 });
      
      // Search users
      const users = await this.searchUsers({ query, limit: 5 });
      
      // Search comments
      const comments = await this.searchComments({ query, userId, limit: 5 });

      const totalItems = projects.length + tasks.length + users.length + comments.length;

      return {
        projects,
        tasks,
        users,
        comments,
        pagination: {
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search projects
   */
  async searchProjects(options = {}) {
    const { query = '', userId, limit = 10 } = options;
    
    try {
      let sqlQuery = `
        SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE (p.name LIKE ? OR p.description LIKE ?)
      `;
      
      const queryParams = [`%${query}%`, `%${query}%`];
      
      if (userId) {
        sqlQuery += ` AND (p.created_by = ? OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = ?
        ))`;
        queryParams.push(userId, userId);
      }
      
      sqlQuery += ` ORDER BY p.created_at DESC LIMIT ?`;
      queryParams.push(limit);
      
  const rows = await database.query(sqlQuery, queryParams);
  return rows.map(row => snakeToCamel(row));
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search tasks
   */
  async searchTasks(options = {}) {
    const { query = '', userId, limit = 10 } = options;
    
    try {
      let sqlQuery = `
        SELECT t.*, p.name as project_name,
               CONCAT(u_assigned.first_name, ' ', u_assigned.last_name) as assigned_to_name,
               CONCAT(u_created.first_name, ' ', u_created.last_name) as created_by_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
        LEFT JOIN users u_created ON t.created_by = u_created.id
        WHERE (t.title LIKE ? OR t.description LIKE ?)
      `;
      
      const queryParams = [`%${query}%`, `%${query}%`];
      
      if (userId) {
        sqlQuery += ` AND (t.assigned_to = ? OR t.created_by = ? OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = t.project_id AND pm.user_id = ?
        ))`;
        queryParams.push(userId, userId, userId);
      }
      
      sqlQuery += ` ORDER BY t.created_at DESC LIMIT ?`;
      queryParams.push(limit);
      
  const rows = await database.query(sqlQuery, queryParams);
  return rows.map(row => snakeToCamel(row));
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search users
   */
  async searchUsers(options = {}) {
    const { query = '', limit = 10 } = options;
    
    try {
      const sqlQuery = `
        SELECT id, first_name, last_name, email, role, avatar_url, created_at
        FROM users 
        WHERE is_active = TRUE 
        AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      const queryParams = [`%${query}%`, `%${query}%`, `%${query}%`, limit];
      
  const rows = await database.query(sqlQuery, queryParams);
  return rows.map(row => snakeToCamel(row));
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search comments
   */
  async searchComments(options = {}) {
    const { query = '', userId, limit = 10 } = options;
    
    try {
      let sqlQuery = `
        SELECT c.*, t.title as task_title, p.name as project_name,
               CONCAT(u.first_name, ' ', u.last_name) as user_name
        FROM task_comments c
        LEFT JOIN tasks t ON c.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.comment LIKE ?
      `;
      
      const queryParams = [`%${query}%`];
      
      if (userId) {
        sqlQuery += ` AND EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = t.project_id AND pm.user_id = ?
        )`;
        queryParams.push(userId);
      }
      
      sqlQuery += ` ORDER BY c.created_at DESC LIMIT ?`;
      queryParams.push(limit);
      
  const rows = await database.query(sqlQuery, queryParams);
  return rows.map(row => snakeToCamel(row));
      
    } catch (error) {
      throw error;
    }
  }
}

export default new SearchService();