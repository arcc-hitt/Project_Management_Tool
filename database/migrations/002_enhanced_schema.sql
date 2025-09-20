-- Enhanced Project Management Tool Database Schema
-- MySQL Database Enhancement Script
-- This script adds additional tables and features to the existing schema

USE project_management_tool;

-- Add missing columns to existing tables if they don't exist
-- Users table enhancements
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;

-- Projects table enhancements  
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS repository_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS tags JSON;

-- Tasks table enhancements
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS tags JSON,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS story_points INT,
ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Table: activity_logs
-- Comprehensive activity tracking for auditing
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type ENUM('user', 'project', 'task', 'comment', 'file') NOT NULL,
    entity_id INT NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Table: project_files
-- File attachments for projects
CREATE TABLE IF NOT EXISTS project_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    task_id INT NULL,
    uploaded_by INT NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_project_id (project_id),
    INDEX idx_task_id (task_id),
    INDEX idx_uploaded_by (uploaded_by)
);

-- Table: time_entries
-- Time tracking for tasks
CREATE TABLE IF NOT EXISTS time_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    description TEXT,
    hours_spent DECIMAL(5,2) NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Table: project_templates
-- Reusable project templates
CREATE TABLE IF NOT EXISTS project_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSON NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_created_by (created_by),
    INDEX idx_is_public (is_public)
);

-- Table: user_preferences
-- User-specific settings and preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    theme ENUM('light', 'dark', 'auto') DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format ENUM('12h', '24h') DEFAULT '24h',
    notifications_email BOOLEAN DEFAULT TRUE,
    notifications_push BOOLEAN DEFAULT TRUE,
    dashboard_layout JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preferences (user_id)
);

-- Table: api_tokens
-- API access tokens for integrations
CREATE TABLE IF NOT EXISTS api_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    permissions JSON,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_is_active (is_active)
);

-- Enhanced Views

-- View: detailed_project_stats
-- Enhanced project statistics with time tracking
CREATE OR REPLACE VIEW detailed_project_stats AS
SELECT 
    p.id,
    p.name,
    p.status,
    p.priority,
    p.start_date,
    p.end_date,
    p.budget,
    p.actual_cost,
    p.progress_percentage,
    COUNT(DISTINCT pm.user_id) as team_size,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as pending_tasks,
    SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
    SUM(t.estimated_hours) as total_estimated_hours,
    SUM(t.actual_hours) as total_actual_hours,
    ROUND(
        (SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) * 100.0) / 
        NULLIF(COUNT(t.id), 0), 2
    ) as completion_percentage_by_tasks
FROM projects p
LEFT JOIN project_members pm ON p.id = pm.project_id
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, p.name, p.status, p.priority, p.start_date, p.end_date, p.budget, p.actual_cost, p.progress_percentage;

-- View: user_productivity_stats
-- User productivity and workload statistics
CREATE OR REPLACE VIEW user_productivity_stats AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.role,
    COUNT(DISTINCT pm.project_id) as active_projects,
    COUNT(t.id) as total_assigned_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
    SUM(t.estimated_hours) as total_estimated_hours,
    SUM(t.actual_hours) as total_actual_hours,
    COALESCE(te.total_logged_hours, 0) as total_logged_hours,
    ROUND(
        (SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) * 100.0) / 
        NULLIF(COUNT(t.id), 0), 2
    ) as task_completion_rate
FROM users u
LEFT JOIN project_members pm ON u.id = pm.user_id
LEFT JOIN tasks t ON u.id = t.assigned_to
LEFT JOIN (
    SELECT user_id, SUM(hours_spent) as total_logged_hours
    FROM time_entries
    GROUP BY user_id
) te ON u.id = te.user_id
WHERE u.is_active = TRUE
GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, te.total_logged_hours;

-- View: task_activity_summary
-- Recent task activities for dashboard
CREATE OR REPLACE VIEW task_activity_summary AS
SELECT 
    t.id as task_id,
    t.title,
    t.status,
    t.priority,
    p.name as project_name,
    CONCAT(u_assigned.first_name, ' ', u_assigned.last_name) as assigned_to_name,
    CONCAT(u_created.first_name, ' ', u_created.last_name) as created_by_name,
    t.due_date,
    t.created_at,
    t.updated_at,
    CASE 
        WHEN t.due_date < NOW() AND t.status != 'done' THEN 'overdue'
        WHEN t.due_date < DATE_ADD(NOW(), INTERVAL 3 DAY) AND t.status != 'done' THEN 'due_soon'
        ELSE 'normal'
    END as urgency_status
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
LEFT JOIN users u_created ON t.created_by = u_created.id
ORDER BY t.updated_at DESC;

-- Add additional indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_projects_budget ON projects(budget);
CREATE INDEX IF NOT EXISTS idx_projects_progress ON projects(progress_percentage);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_story_points ON tasks(story_points);
CREATE INDEX IF NOT EXISTS idx_tasks_blocked ON tasks(blocked);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_entity ON activity_logs(action, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_dates ON time_entries(start_time, end_time);

-- Triggers for automatic updates

-- Trigger: Update project progress percentage when tasks change
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_project_progress_on_task_change
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    DECLARE total_tasks INT DEFAULT 0;
    DECLARE completed_tasks INT DEFAULT 0;
    DECLARE progress DECIMAL(5,2) DEFAULT 0.00;
    
    SELECT COUNT(*), SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)
    INTO total_tasks, completed_tasks
    FROM tasks 
    WHERE project_id = NEW.project_id;
    
    IF total_tasks > 0 THEN
        SET progress = ROUND((completed_tasks * 100.0) / total_tasks, 2);
    END IF;
    
    UPDATE projects 
    SET progress_percentage = progress,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;
END//

-- Trigger: Log activity when tasks are updated
CREATE TRIGGER IF NOT EXISTS log_task_activity
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
        NEW.assigned_to,
        'task_updated',
        'task',
        NEW.id,
        JSON_OBJECT(
            'status', OLD.status,
            'priority', OLD.priority,
            'assigned_to', OLD.assigned_to
        ),
        JSON_OBJECT(
            'status', NEW.status,
            'priority', NEW.priority,
            'assigned_to', NEW.assigned_to
        )
    );
END//

-- Trigger: Set completed_at timestamp when task is marked as done
CREATE TRIGGER IF NOT EXISTS set_task_completed_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
BEGIN
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        SET NEW.completed_at = CURRENT_TIMESTAMP;
    ELSEIF NEW.status != 'done' AND OLD.status = 'done' THEN
        SET NEW.completed_at = NULL;
    END IF;
END//

DELIMITER ;

-- Insert default user preferences for existing users
INSERT IGNORE INTO user_preferences (user_id, theme, language, notifications_email, notifications_push)
SELECT id, 'light', 'en', TRUE, TRUE FROM users WHERE is_active = TRUE;