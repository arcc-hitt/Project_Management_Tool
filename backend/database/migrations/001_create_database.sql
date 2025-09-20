-- Project Management Tool Database Schema
-- MySQL Database Creation Script

-- Create Database
CREATE DATABASE IF NOT EXISTS project_management_tool 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE project_management_tool;

-- Table: users
-- Stores user information with role-based access
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'manager', 'developer') NOT NULL DEFAULT 'developer',
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Table: projects
-- Stores project information and metadata
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') NOT NULL DEFAULT 'planning',
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    start_date DATE,
    end_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_created_by (created_by),
    INDEX idx_dates (start_date, end_date)
);

-- Table: project_members
-- Maps users to projects (many-to-many relationship)
CREATE TABLE project_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('manager', 'developer', 'tester', 'designer') NOT NULL DEFAULT 'developer',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_user (project_id, user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_user_id (user_id)
);

-- Table: tasks
-- Stores individual tasks within projects
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in_progress', 'in_review', 'done') NOT NULL DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    project_id INT NOT NULL,
    assigned_to INT,
    created_by INT NOT NULL,
    due_date DATETIME,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_project_id (project_id),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_due_date (due_date),
    INDEX idx_created_by (created_by)
);

-- Table: task_comments
-- Stores comments on tasks for collaboration
CREATE TABLE task_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Table: user_stories (for AI-generated stories)
-- Stores AI-generated user stories linked to projects
CREATE TABLE user_stories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    story TEXT NOT NULL,
    acceptance_criteria TEXT,
    story_points INT,
    status ENUM('backlog', 'ready', 'in_progress', 'done') NOT NULL DEFAULT 'backlog',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_project_id (project_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
);

-- Table: task_dependencies
-- Manages task dependencies (optional enhancement)
CREATE TABLE task_dependencies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    depends_on_task_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_dependency (task_id, depends_on_task_id),
    INDEX idx_task_id (task_id),
    INDEX idx_depends_on (depends_on_task_id)
);

-- Table: notifications
-- System notifications for users
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'error', 'success') NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- Create Views for Common Queries

-- View: project_stats
-- Provides project statistics including task counts
CREATE VIEW project_stats AS
SELECT 
    p.id,
    p.name,
    p.status,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as pending_tasks,
    SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks,
    ROUND(
        (SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) * 100.0) / 
        NULLIF(COUNT(t.id), 0), 2
    ) as completion_percentage
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, p.name, p.status;

-- View: user_task_summary
-- Provides task summary for each user
CREATE VIEW user_task_summary AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    COUNT(t.id) as total_assigned_tasks,
    SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN 1 ELSE 0 END) as overdue_tasks
FROM users u
LEFT JOIN tasks t ON u.id = t.assigned_to
WHERE u.is_active = TRUE
GROUP BY u.id, u.first_name, u.last_name, u.email;