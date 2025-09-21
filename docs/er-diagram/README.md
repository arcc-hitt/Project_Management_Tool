# Project Management Tool - Database Design

## Entity Relationship Diagram

```mermaid
erDiagram
   users {
      INT id PK
      VARCHAR email "UQ"
      VARCHAR password_hash
      VARCHAR first_name
      VARCHAR last_name
      ENUM role
      VARCHAR avatar_url
      VARCHAR phone
      VARCHAR timezone
      BOOLEAN email_verified
      TIMESTAMP email_verified_at
      TIMESTAMP last_login
      BOOLEAN is_active
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   projects {
      INT id PK
      VARCHAR name
      TEXT description
      ENUM status
      ENUM priority
      DATE start_date
      DATE end_date
      DECIMAL budget
      DECIMAL actual_cost
      INT progress_percentage
      VARCHAR repository_url
      JSON tags
      INT created_by FK
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   project_members {
      INT id PK
      INT project_id FK
      INT user_id FK
      ENUM role
      TIMESTAMP joined_at
   }

   tasks {
      INT id PK
      VARCHAR title
      TEXT description
      ENUM status
      ENUM priority
      INT project_id FK
      INT assigned_to FK
      INT created_by FK
      DATETIME due_date
      DECIMAL estimated_hours
      DECIMAL actual_hours
      TIMESTAMP completed_at
      JSON tags
      INT story_points
      BOOLEAN blocked
      TEXT blocked_reason
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   task_comments {
      INT id PK
      INT task_id FK
      INT user_id FK
      TEXT comment
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   user_stories {
      INT id PK
      INT project_id FK
      TEXT story
      TEXT acceptance_criteria
      INT story_points
      ENUM status
      INT created_by FK
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   task_dependencies {
      INT id PK
      INT task_id FK
      INT depends_on_task_id FK
      TIMESTAMP created_at
   }

   notifications {
      INT id PK
      INT user_id FK
      ENUM type
      VARCHAR title
      TEXT message
      ENUM entity_type
      INT entity_id
      BOOLEAN is_read
      TIMESTAMP created_at
   }

   activity_logs {
      INT id PK
      INT user_id FK NULL
      VARCHAR action
      ENUM entity_type
      INT entity_id
      JSON old_values
      JSON new_values
      VARCHAR ip_address
      TEXT user_agent
      TIMESTAMP created_at
   }

   time_entries {
      INT id PK
      INT task_id FK
      INT user_id FK
      TEXT description
      DECIMAL hours_spent
      TIMESTAMP start_time
      TIMESTAMP end_time
      TIMESTAMP created_at
      TIMESTAMP updated_at
   }

   users ||--o{ projects : "created_by"
   projects ||--o{ tasks : ""
   users ||--o{ tasks : "assigned_to"
   users ||--o{ tasks : "created_by"
   tasks ||--o{ task_comments : ""
   users ||--o{ task_comments : ""
   projects ||--o{ project_members : ""
   users ||--o{ project_members : ""
   tasks ||--o{ task_dependencies : "task_id"
   tasks ||--o{ task_dependencies : "depends_on"
   users ||--o{ notifications : ""
   projects ||--o{ user_stories : ""
   users ||--o{ user_stories : "created_by"
   tasks ||--o{ time_entries : ""
   users ||--o{ time_entries : ""
   users ||--o{ activity_logs : ""
```

Notes
- JSON columns (projects.tags, tasks.tags, activity_logs.old_values/new_values) may be stored as TEXT on older MySQL versions; migrations handle fallback.
- Some foreign keys are nullable by design (e.g., notifications.entity_id, activity_logs.user_id).

## Database Views

### project_stats
Aggregates project statistics including task counts and completion percentages.

### user_task_summary  
Provides summary of task assignments and completion status for each user.

## Key Relationships

1. Users ↔ Projects (Many-to-Many via project_members)
    - Users can be assigned to multiple projects; projects can have multiple members with roles.

2. Projects → Tasks (One-to-Many)
    - A project has many tasks; each task belongs to one project.

3. Users ↔ Tasks (One-to-Many)
    - Users may be task assignees and/or creators; assignment is optional.

4. Tasks ↔ Comments (One-to-Many)
    - A task has many comments; each comment belongs to one task and one user.

5. Projects → User Stories (One-to-Many)
    - Projects can have multiple AI-generated user stories; each has a creator.

6. Tasks ↔ Dependencies (Self-referencing via task_dependencies)
    - A task can depend on other tasks and be a dependency for others.

7. Tasks/Users → Time Entries (One-to-Many)
    - Time entries track work logged by users on tasks.

8. Users → Notifications (One-to-Many)
    - Notifications are delivered to users and can reference related entities (task/project/user_story/comment).

9. Users → Activity Logs (One-to-Many)
    - System audit trail for actions taken by users on entities.

## Business Rules

### User Roles
- Admin: Full system access, user management
- Manager: Project creation, team assignment, all project tasks
- Developer: Assigned tasks only, task status updates

### Task Status Flow
```
TODO → IN_PROGRESS → IN_REVIEW → DONE
```

### Project Status Types
- Planning, Active, On Hold, Completed, Cancelled

### Priority Levels
- Low, Medium, High, Critical

## Indexes

Common indexes include:
- users: email, role, is_active
- projects: status, priority, created_by, dates
- tasks: status, priority, project_id, assigned_to, due_date, created_by
- task_comments: task_id, user_id, created_at
- notifications: user_id, is_read, created_at
- time_entries: task_id, user_id, created_at
- activity_logs: user_id, (entity_type, entity_id), action, created_at

## Security Considerations

- Passwords are hashed (bcrypt).
- Foreign key constraints maintain data integrity.
- Soft deletes: users use is_active; most other entities are hard-deleted.
- Role-based access control is enforced at the application level.
