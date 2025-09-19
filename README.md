# Project Management Tool

A comprehensive web application for managing software projects with task tracking, team collaboration, and AI-powered user story generation.

## 🚀 Features

- **User Management**: Role-based access control (Admin, Manager, Developer)
- **Project Management**: Create, edit, and track projects with team assignments
- **Task Management**: Full task lifecycle with status tracking and commenting
- **Dashboard**: Real-time metrics and progress tracking
- **AI Integration**: Automated user story generation using GROQ API
- **Authentication**: JWT-based secure authentication

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js (Latest)
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT
- **Documentation**: Swagger
- **Testing**: Jest
- **AI Integration**: GROQ API

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI
- **State Management**: Context API + React Query
- **Routing**: React Router v6

## 📁 Project Structure

```
project-management-tool/
├── backend/                 # Node.js Backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Custom middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utilities
│   │   └── config/         # Configuration
│   ├── tests/              # Unit tests
│   └── docs/               # API documentation
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── utils/          # Utilities
│   │   └── types/          # TypeScript types
│   └── public/             # Static assets
├── database/               # Database scripts
│   ├── migrations/         # SQL migrations
│   └── seeds/             # Sample data
└── docs/                  # Project documentation
    ├── api/               # API documentation
    └── er-diagram/        # Database design
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project-management-tool
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Database Setup**
   ```bash
   # Create MySQL database
   mysql -u root -p -e "CREATE DATABASE project_management_tool;"
   
   # Run migrations
   cd backend
   npm run migrate
   npm run seed
   ```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/members` - Add team member

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task by ID
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/comments` - Add comment

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/overdue` - Get overdue tasks
- `GET /api/dashboard/progress/:projectId` - Get project progress

### AI Features (Bonus)
- `POST /api/ai/generate-user-stories` - Generate user stories from description

## 🏗 Development Workflow

The project is organized into feature branches for easy development:

1. **main** - Production ready code
2. **feature/backend-foundation** - Basic Express setup
3. **feature/authentication** - JWT authentication
4. **feature/user-management** - User CRUD operations
5. **feature/project-management** - Project management APIs
6. **feature/task-management** - Task management APIs
7. **feature/dashboard-apis** - Dashboard and reporting
8. **feature/frontend-foundation** - React setup
9. **feature/frontend-auth** - Frontend authentication
10. **feature/frontend-projects** - Project management UI
11. **feature/frontend-tasks** - Task management UI
12. **feature/frontend-dashboard** - Dashboard UI
13. **feature/ai-integration** - GROQ API integration

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📊 Database Schema

Refer to `docs/er-diagram/` for the complete database design.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🎯 Assumptions and Future Improvements

### Assumptions
- Users will have valid email addresses
- MySQL is available and configured
- GROQ API key is provided for AI features

### Possible Improvements
- Real-time notifications using WebSockets
- File attachment support for tasks
- Advanced reporting with charts
- Mobile application
- Integration with external tools (Slack, Jira)
- Advanced AI features (task prioritization, time estimation)