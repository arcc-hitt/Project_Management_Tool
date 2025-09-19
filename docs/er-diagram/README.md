# Project Management Tool - Database Design

## Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     USERS       │         │    PROJECTS     │         │     TASKS       │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ • id (PK)       │    ┌────│ • id (PK)       │────┐    │ • id (PK)       │
│ • email (UQ)    │    │    │ • name          │    │    │ • title         │
│ • password_hash │    │    │ • description   │    │    │ • description   │
│ • first_name    │    │    │ • status        │    │    │ • status        │
│ • last_name     │    │    │ • priority      │    │    │ • priority      │
│ • role          │    │    │ • start_date    │    │    │ • project_id(FK)│
│ • avatar_url    │    │    │ • end_date      │    │    │ • assigned_to(FK)│
│ • is_active     │    │    │ • created_by(FK)│    │    │ • created_by(FK)│
│ • created_at    │    │    │ • created_at    │    │    │ • due_date      │
│ • updated_at    │    │    │ • updated_at    │    │    │ • estimated_hrs │
└─────────────────┘    │    └─────────────────┘    │    │ • actual_hours  │
         │              │                           │    │ • created_at    │
         │              │                           │    │ • updated_at    │
         │              │                           │    └─────────────────┘
         │              │                           │              │
         │              │                           │              │
         └──────────────┼───────────────────────────┘              │
                        │                                          │
                        │                                          │
         ┌──────────────┼──────────────┐                          │
         │              │              │                          │
         │              │              │                          │
┌─────────────────┐     │    ┌─────────────────┐                  │
│ PROJECT_MEMBERS │     │    │ TASK_COMMENTS   │                  │
├─────────────────┤     │    ├─────────────────┤                  │
│ • id (PK)       │     │    │ • id (PK)       │                  │
│ • project_id(FK)│─────┘    │ • task_id (FK)  │──────────────────┘
│ • user_id (FK)  │──────────│ • user_id (FK)  │
│ • role          │          │ • comment       │
│ • joined_at     │          │ • created_at    │
└─────────────────┘          └─────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  USER_STORIES   │         │TASK_DEPENDENCIES│         │ NOTIFICATIONS   │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ • id (PK)       │         │ • id (PK)       │         │ • id (PK)       │
│ • project_id(FK)│─────────│ • task_id (FK)  │         │ • user_id (FK)  │───┐
│ • story         │         │ • depends_on(FK)│         │ • title         │   │
│ • acceptance_   │         │ • created_at    │         │ • message       │   │
│   criteria      │         └─────────────────┘         │ • type          │   │
│ • story_points  │                   │                 │ • is_read       │   │
│ • status        │                   │                 │ • created_at    │   │
│ • created_by(FK)│                   │                 └─────────────────┘   │
│ • created_at    │                   │                           │           │
│ • updated_at    │                   │                           │           │
└─────────────────┘                   │                           │           │
                                      │                           │           │
                                      └───────────────────────────┘           │
                                                                              │
                                              ┌───────────────────────────────┘
                                              │
                                        ┌─────────────────┐
                                        │     USERS       │
                                        │   (Reference)   │
                                        └─────────────────┘
```

## Database Views

### project_stats
Aggregates project statistics including task counts and completion percentages.

### user_task_summary  
Provides summary of task assignments and completion status for each user.

## Key Relationships

1. **Users ↔ Projects** (Many-to-Many through project_members)
   - Users can be assigned to multiple projects
   - Projects can have multiple team members
   - Each assignment has a specific role

2. **Projects → Tasks** (One-to-Many)
   - Each project can have multiple tasks
   - Tasks belong to exactly one project

3. **Users ↔ Tasks** (One-to-Many)
   - Users can be assigned to multiple tasks
   - Each task can be assigned to one user (or none)
   - Users can create multiple tasks

4. **Tasks ↔ Comments** (One-to-Many)
   - Each task can have multiple comments
   - Comments belong to exactly one task and one user

5. **Projects → User Stories** (One-to-Many)
   - Projects can have multiple AI-generated user stories
   - User stories belong to exactly one project

6. **Tasks ↔ Dependencies** (Many-to-Many through task_dependencies)
   - Tasks can depend on other tasks
   - Tasks can be dependencies for other tasks

## Business Rules

### User Roles
- **Admin**: Full system access, user management
- **Manager**: Project creation, team assignment, all project tasks
- **Developer**: Assigned tasks only, task status updates

### Task Status Flow
```
TODO → IN_PROGRESS → IN_REVIEW → DONE
```

### Project Status Types
- **Planning**: Initial project setup
- **Active**: Currently being worked on
- **On Hold**: Temporarily paused
- **Completed**: Successfully finished
- **Cancelled**: Terminated before completion

### Priority Levels
- **Low**: Non-urgent tasks/projects
- **Medium**: Standard priority (default)
- **High**: Important items requiring attention
- **Critical**: Urgent items requiring immediate attention

## Indexes

Key indexes are created for:
- User email and role lookups
- Project status and priority filtering
- Task assignments and due dates
- Comment and notification chronological ordering

## Security Considerations

- User passwords are hashed (bcrypt)
- Foreign key constraints maintain data integrity
- Soft deletes preserve historical data
- Role-based access control implemented at application level