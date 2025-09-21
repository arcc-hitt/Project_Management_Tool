-- Sample Data for Project Management Tool
-- Run this after creating the database schema

USE project_management_tool;

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) VALUES
('admin@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1JQxNj8xzq', 'Admin', 'User', 'admin', TRUE),
('john.manager@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1JQxNj8xzq', 'John', 'Manager', 'manager', TRUE),
('sarah.dev@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1JQxNj8xzq', 'Sarah', 'Developer', 'developer', TRUE),
('mike.dev@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1JQxNj8xzq', 'Mike', 'Developer', 'developer', TRUE),
('jane.dev@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1JQxNj8xzq', 'Jane', 'Developer', 'developer', TRUE);

-- Note: The hash above corresponds to an old default ('password123'). The seed script updates these to 'Password123' post-insert.

-- Insert sample projects
INSERT INTO projects (name, description, status, priority, start_date, end_date, created_by) VALUES
('E-commerce Platform', 'A modern e-commerce website with cart and payment functionality', 'active', 'high', '2024-01-15', '2024-06-15', 2),
('Mobile App Development', 'iOS and Android mobile application for the e-commerce platform', 'planning', 'medium', '2024-03-01', '2024-08-01', 2),
('Data Analytics Dashboard', 'Business intelligence dashboard for sales and user analytics', 'active', 'medium', '2024-02-01', '2024-05-01', 1);

-- Insert project members
INSERT INTO project_members (project_id, user_id, role) VALUES
-- E-commerce Platform team
(1, 2, 'manager'),
(1, 3, 'developer'),
(1, 4, 'developer'),
-- Mobile App Development team
(2, 2, 'manager'),
(2, 5, 'developer'),
-- Data Analytics Dashboard team
(3, 1, 'manager'),
(3, 3, 'developer'),
(3, 4, 'developer');

-- Insert sample tasks
INSERT INTO tasks (title, description, status, priority, project_id, assigned_to, created_by, due_date, estimated_hours) VALUES
-- E-commerce Platform tasks
('Set up project structure', 'Initialize the project with proper folder structure and dependencies', 'done', 'high', 1, 3, 2, '2024-01-20 17:00:00', 8),
('Design user authentication', 'Implement login, register, and password reset functionality', 'done', 'high', 1, 3, 2, '2024-01-25 17:00:00', 16),
('Create product catalog', 'Build product listing, search, and filtering features', 'in_progress', 'high', 1, 4, 2, '2024-02-05 17:00:00', 24),
('Implement shopping cart', 'Add to cart, update quantities, and checkout flow', 'todo', 'medium', 1, 4, 2, '2024-02-15 17:00:00', 20),
('Payment integration', 'Integrate Stripe or PayPal for payment processing', 'todo', 'high', 1, 3, 2, '2024-02-20 17:00:00', 16),

-- Mobile App Development tasks
('Research framework', 'Evaluate React Native vs Flutter for cross-platform development', 'in_progress', 'high', 2, 5, 2, '2024-03-10 17:00:00', 12),
('Create app wireframes', 'Design user interface mockups and user flow', 'todo', 'medium', 2, 5, 2, '2024-03-15 17:00:00', 16),

-- Data Analytics Dashboard tasks
('Database design', 'Design data warehouse schema for analytics', 'done', 'high', 3, 3, 1, '2024-02-05 17:00:00', 12),
('Data pipeline setup', 'Create ETL pipelines for data processing', 'in_progress', 'high', 3, 4, 1, '2024-02-10 17:00:00', 20),
('Dashboard UI', 'Build responsive dashboard with charts and metrics', 'todo', 'medium', 3, 3, 1, '2024-02-20 17:00:00', 24);

-- Insert sample task comments
INSERT INTO task_comments (task_id, user_id, comment) VALUES
(1, 3, 'Project structure is complete. Used Node.js with Express framework.'),
(1, 2, 'Great! Please make sure to follow the coding standards we discussed.'),
(2, 3, 'Authentication system is working. JWT tokens implemented for session management.'),
(2, 2, 'Excellent work! Please add password strength validation as well.'),
(3, 4, 'Working on the product filtering functionality. Should be ready by tomorrow.'),
(8, 3, 'Database schema is finalized. Used star schema for optimal query performance.'),
(9, 4, 'ETL pipeline is 70% complete. Working on the data transformation logic.');

-- Insert sample user stories (AI-generated examples)
INSERT INTO user_stories (project_id, story, acceptance_criteria, story_points, status, created_by) VALUES
(1, 'As a customer, I want to browse products by category, so that I can easily find what I''m looking for.', 'Given I am on the homepage, When I click on a category, Then I should see all products in that category with filtering options.', 3, 'done', 2),
(1, 'As a customer, I want to add products to my cart, so that I can purchase multiple items at once.', 'Given I am viewing a product, When I click "Add to Cart", Then the product should be added to my cart and cart count should update.', 5, 'in_progress', 2),
(1, 'As an admin, I want to manage the product catalog, so that I can keep the inventory up to date.', 'Given I am logged in as admin, When I navigate to product management, Then I should be able to add, edit, and delete products.', 8, 'backlog', 2),
(2, 'As a user, I want to receive push notifications, so that I stay updated about order status.', 'Given I have the mobile app installed, When my order status changes, Then I should receive a push notification.', 5, 'backlog', 2),
(3, 'As a business analyst, I want to view sales trends, so that I can make informed business decisions.', 'Given I am on the dashboard, When I select a date range, Then I should see sales trends with interactive charts.', 8, 'in_progress', 1);

-- Insert sample notifications
INSERT INTO notifications (user_id, title, message, type, is_read) VALUES
(3, 'Task Assigned', 'You have been assigned to "Payment integration" task', 'info', FALSE),
(4, 'Task Due Soon', 'Your task "Create product catalog" is due in 2 days', 'warning', FALSE),
(5, 'Welcome', 'Welcome to the Project Management Tool!', 'success', TRUE),
(2, 'Project Update', 'E-commerce Platform project is 60% complete', 'info', TRUE);

-- Insert task dependencies (example)
INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES
(4, 3), -- Shopping cart depends on product catalog
(5, 4); -- Payment integration depends on shopping cart

-- Verify the data
SELECT 'Users created:' as info, COUNT(*) as count FROM users
UNION ALL
SELECT 'Projects created:', COUNT(*) FROM projects
UNION ALL
SELECT 'Tasks created:', COUNT(*) FROM tasks
UNION ALL
SELECT 'Comments added:', COUNT(*) FROM task_comments
UNION ALL
SELECT 'User stories created:', COUNT(*) FROM user_stories;