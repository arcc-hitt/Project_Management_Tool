import database from '../config/database.js';
import { 
  snakeToCamel, 
  camelToSnake,
  getPaginationSQL,
  formatDateForDB 
} from '../utils/helpers.js';

class ProjectService {
  /**
   * Get all projects with pagination and filtering
   * @param {object} options - Query options
   * @param {number} userId - Current user ID for permission filtering
   * @returns {object} Projects data with pagination
   */
  async getAllProjects(options = {}, userId, userRole) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority, 
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      // Build WHERE clause based on user role
      let whereClause = 'WHERE 1=1';
      let queryParams = [];

      // Role-based filtering
      if (userRole === 'developer') {
        // Developers can only see projects they are assigned to
        whereClause += ' AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)';
        queryParams.push(userId);
      }

      if (status) {
        whereClause += ' AND p.status = ?';
        queryParams.push(status);
      }

      if (priority) {
        whereClause += ' AND p.priority = ?';
        queryParams.push(priority);
      }

      if (search) {
        whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }

      // Validate sort column
      const allowedSortColumns = ['id', 'name', 'status', 'priority', 'start_date', 'end_date', 'created_at'];
      const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total 
        FROM projects p
        ${userRole === 'developer' ? 'LEFT JOIN project_members pm ON p.id = pm.project_id' : ''}
        ${whereClause}
      `;
      const [countResult] = await database.query(countQuery, queryParams);
      const totalProjects = countResult.total;

      // Get paginated projects with creator info
      const { limit: sqlLimit, offset } = getPaginationSQL(page, limit);
      const projectsQuery = `
        SELECT DISTINCT p.id, p.name, p.description, p.status, p.priority, 
               p.start_date, p.end_date, p.created_by, p.created_at, p.updated_at,
               u.first_name as creator_first_name, u.last_name as creator_last_name,
               (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        ${userRole === 'developer' ? 'LEFT JOIN project_members pm ON p.id = pm.project_id' : ''}
        ${whereClause}
        ORDER BY p.${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `;

      const projects = await database.query(projectsQuery, [...queryParams, sqlLimit, offset]);

      return {
        projects: projects.map(project => snakeToCamel(project)),
        pagination: {
          totalItems: totalProjects,
          totalPages: Math.ceil(totalProjects / limit),
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalProjects / limit),
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get project by ID with team members
   * @param {number} projectId - Project ID
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @returns {object|null} Project data with team members
   */
  async getProjectById(projectId, userId, userRole) {
    try {
      // Check if user has access to this project
      if (userRole === 'developer') {
        const accessCheck = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, userId]
        );
        if (accessCheck.length === 0) {
          throw new Error('Access denied to this project');
        }
      }

      // Get project details
      const projectQuery = `
        SELECT p.id, p.name, p.description, p.status, p.priority, 
               p.start_date, p.end_date, p.created_by, p.created_at, p.updated_at,
               u.first_name as creator_first_name, u.last_name as creator_last_name,
               u.email as creator_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `;
      
      const projects = await database.query(projectQuery, [projectId]);
      if (projects.length === 0) {
        return null;
      }

      const project = snakeToCamel(projects[0]);

      // Get team members
      const membersQuery = `
        SELECT pm.user_id, pm.role, pm.joined_at,
               u.first_name, u.last_name, u.email, u.avatar_url
        FROM project_members pm
        LEFT JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ? AND u.is_active = TRUE
        ORDER BY pm.joined_at ASC
      `;

      const members = await database.query(membersQuery, [projectId]);
      project.teamMembers = members.map(member => snakeToCamel(member));

      // Get project statistics
      const statsQuery = `
        SELECT 
          COUNT(t.id) as total_tasks,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as pending_tasks,
          SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks
        FROM tasks t
        WHERE t.project_id = ?
      `;

      const [stats] = await database.query(statsQuery, [projectId]);
      project.statistics = snakeToCamel(stats);

      return project;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data
   * @param {number} createdBy - ID of user creating the project
   * @returns {object} Created project data
   */
  async createProject(projectData, createdBy) {
    const { 
      name, 
      description, 
      status = 'planning',
      priority = 'medium',
      startDate,
      endDate,
      teamMembers = []
    } = projectData;

    try {
      return await database.transaction(async (connection) => {
        // Insert project
        const insertQuery = `
          INSERT INTO projects (name, description, status, priority, start_date, end_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await connection.execute(insertQuery, [
          name, 
          description, 
          status, 
          priority,
          formatDateForDB(startDate),
          formatDateForDB(endDate),
          createdBy
        ]);

        const projectId = result.insertId;

        // Add creator as project manager
        await connection.execute(
          'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
          [projectId, createdBy, 'manager']
        );

        // Add team members if provided
        if (teamMembers.length > 0) {
          for (const member of teamMembers) {
            await connection.execute(
              'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
              [projectId, member.userId, member.role || 'developer']
            );
          }
        }

        // Return created project
        return await this.getProjectById(projectId, createdBy, 'admin');
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update project
   * @param {number} projectId - Project ID
   * @param {object} projectData - Updated project data
   * @param {number} updatedBy - ID of user making the update
   * @param {string} userRole - Role of user making the update
   * @returns {object} Updated project data
   */
  async updateProject(projectId, projectData, updatedBy, userRole) {
    try {
      // Check if project exists and user has permission
      const existingProject = await this.getProjectById(projectId, updatedBy, userRole);
      if (!existingProject) {
        throw new Error('Project not found or access denied');
      }

      // Prepare update data
      const allowedFields = ['name', 'description', 'status', 'priority', 'start_date', 'end_date'];
      const updateData = {};
      
      Object.keys(projectData).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          if (key === 'startDate' || key === 'endDate') {
            updateData[snakeKey] = formatDateForDB(projectData[key]);
          } else {
            updateData[snakeKey] = projectData[key];
          }
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Build update query
      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateQuery = `
        UPDATE projects 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [...Object.values(updateData), projectId]);

      // Return updated project
      return await this.getProjectById(projectId, updatedBy, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete project
   * @param {number} projectId - Project ID
   * @param {number} deletedBy - ID of user performing deletion
   * @param {string} userRole - Role of user performing deletion
   * @returns {boolean} Success status
   */
  async deleteProject(projectId, deletedBy, userRole) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, deletedBy, userRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Only allow deletion by admin or project creator
      if (userRole !== 'admin' && project.createdBy !== deletedBy) {
        throw new Error('Only project creator or admin can delete this project');
      }

      // Delete project (cascading deletes will handle related records)
      await database.query('DELETE FROM projects WHERE id = ?', [projectId]);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Add team member to project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to add
   * @param {string} role - Role in project
   * @param {number} addedBy - ID of user adding the member
   * @param {string} addedByRole - Role of user adding the member
   * @returns {object} Updated project data
   */
  async addTeamMember(projectId, userId, role = 'developer', addedBy, addedByRole) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, addedBy, addedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Check if user is already a member
      const existingMember = await database.query(
        'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
      );

      if (existingMember.length > 0) {
        throw new Error('User is already a member of this project');
      }

      // Verify user exists
      const userExists = await database.query(
        'SELECT 1 FROM users WHERE id = ? AND is_active = TRUE',
        [userId]
      );

      if (userExists.length === 0) {
        throw new Error('User not found or inactive');
      }

      // Add team member
      await database.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
        [projectId, userId, role]
      );

      // Return updated project
      return await this.getProjectById(projectId, addedBy, addedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove team member from project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to remove
   * @param {number} removedBy - ID of user removing the member
   * @param {string} removedByRole - Role of user removing the member
   * @returns {object} Updated project data
   */
  async removeTeamMember(projectId, userId, removedBy, removedByRole) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, removedBy, removedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Don't allow removing the project creator
      if (project.createdBy === userId) {
        throw new Error('Cannot remove project creator from team');
      }

      // Remove team member
      const result = await database.query(
        'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('User is not a member of this project');
      }

      // Return updated project
      return await this.getProjectById(projectId, removedBy, removedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update team member role
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID
   * @param {string} newRole - New role
   * @param {number} updatedBy - ID of user making the update
   * @param {string} updatedByRole - Role of user making the update
   * @returns {object} Updated project data
   */
  async updateMemberRole(projectId, userId, newRole, updatedBy, updatedByRole) {
    try {
      // Validate role
      const validRoles = ['manager', 'developer', 'tester', 'designer'];
      if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role specified');
      }

      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, updatedBy, updatedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Update member role
      const result = await database.query(
        'UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?',
        [newRole, projectId, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('User is not a member of this project');
      }

      // Return updated project
      return await this.getProjectById(projectId, updatedBy, updatedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get projects where user is a member
   * @param {number} userId - User ID
   * @returns {array} User's projects
   */
  async getUserProjects(userId) {
    try {
      const query = `
        SELECT p.id, p.name, p.description, p.status, p.priority, 
               p.start_date, p.end_date, p.created_at,
               pm.role as user_role,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ?
        ORDER BY p.updated_at DESC
      `;

      const projects = await database.query(query, [userId]);
      return projects.map(project => snakeToCamel(project));

    } catch (error) {
      throw error;
    }
  }
}

export default new ProjectService();