# Git Configuration for Feature Branch Development

## Branch Strategy

This project uses a feature branch workflow with the following structure:

### Main Branches
- `main` - Production-ready code
- `develop` - Integration branch for features

### Feature Branches
Each major feature is developed in its own branch for easy management:

1. `feature/backend-foundation` - Basic Express.js setup
2. `feature/authentication` - JWT authentication system  
3. `feature/user-management` - User CRUD operations
4. `feature/project-management` - Project management APIs
5. `feature/task-management` - Task management APIs
6. `feature/dashboard-apis` - Dashboard and reporting endpoints
7. `feature/frontend-foundation` - React + Vite + TypeScript setup
8. `feature/frontend-auth` - Authentication UI components
9. `feature/frontend-projects` - Project management UI
10. `feature/frontend-tasks` - Task management UI
11. `feature/frontend-dashboard` - Dashboard UI components
12. `feature/ai-integration` - GROQ API integration (Bonus)

## Git Workflow Commands

### Initial Setup
```bash
git init
git add .
git commit -m "Initial project structure and database design"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### Feature Development Workflow

#### 1. Backend Foundation (Patch 1)
```bash
git checkout -b feature/backend-foundation
# Implement backend foundation
git add .
git commit -m "feat: basic Express.js server setup with database connection"
git push origin feature/backend-foundation
```

#### 2. Authentication System (Patch 2)  
```bash
git checkout -b feature/authentication
# Implement authentication
git add .
git commit -m "feat: JWT authentication with role-based access control"
git push origin feature/authentication
```

#### 3. User Management (Patch 3)
```bash
git checkout -b feature/user-management
# Implement user management
git add .
git commit -m "feat: user CRUD operations and role management"
git push origin feature/user-management
```

#### 4. Project Management (Patch 4)
```bash
git checkout -b feature/project-management
# Implement project management
git add .
git commit -m "feat: project CRUD operations with team assignment"
git push origin feature/project-management
```

#### 5. Task Management (Patch 5)
```bash
git checkout -b feature/task-management
# Implement task management
git add .
git commit -m "feat: task CRUD operations with status tracking and comments"
git push origin feature/task-management
```

#### 6. Dashboard APIs (Patch 6)
```bash
git checkout -b feature/dashboard-apis
# Implement dashboard
git add .
git commit -m "feat: dashboard endpoints with metrics and reporting"
git push origin feature/dashboard-apis
```

#### 7. Frontend Foundation (Patch 7)
```bash
git checkout -b feature/frontend-foundation
# Implement frontend foundation
git add .
git commit -m "feat: React + Vite + TypeScript setup with Tailwind CSS"
git push origin feature/frontend-foundation
```

#### 8. Frontend Authentication (Patch 8)
```bash
git checkout -b feature/frontend-auth
# Implement frontend auth
git add .
git commit -m "feat: authentication UI with protected routes"
git push origin feature/frontend-auth
```

#### 9. Frontend Projects (Patch 9)
```bash
git checkout -b feature/frontend-projects
# Implement project UI
git add .
git commit -m "feat: project management UI with team assignment"
git push origin feature/frontend-projects
```

#### 10. Frontend Tasks (Patch 10)
```bash
git checkout -b feature/frontend-tasks
# Implement task UI
git add .
git commit -m "feat: task management UI with kanban board"
git push origin feature/frontend-tasks
```

#### 11. Frontend Dashboard (Patch 11)
```bash
git checkout -b feature/frontend-dashboard
# Implement dashboard UI
git add .
git commit -m "feat: dashboard UI with charts and metrics"
git push origin feature/frontend-dashboard
```

#### 12. AI Integration (Patch 12 - Bonus)
```bash
git checkout -b feature/ai-integration
# Implement AI features
git add .
git commit -m "feat: GROQ API integration for user story generation"
git push origin feature/ai-integration
```

### Merging Features
```bash
# Switch to main branch
git checkout main

# Merge feature branch
git merge feature/backend-foundation
git push origin main

# Delete merged feature branch (optional)
git branch -d feature/backend-foundation
git push origin --delete feature/backend-foundation
```

## Commit Message Convention

Use conventional commits for better version control:

### Types
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Examples
```bash
feat: add user authentication with JWT
fix: resolve database connection timeout
docs: update API documentation
test: add unit tests for user controller
refactor: optimize database queries
```

## Pull Request Template

When creating pull requests, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
```

## Branch Protection Rules

For production repositories, consider these protections:
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to `main` branch