# Project Management Tool

Modern project management web app with task tracking, team collaboration, dashboards, and optional AI-powered helpers.

## Features

- Role-based access control (Admin, Manager, Developer)
- Project and task management with comments and activity log
- Dashboard with stats and progress
- JWT authentication
- AI features via GROQ API

## Tech Stack

- Backend: Node.js 18+, Express, Sequelize (MySQL), JWT
- Frontend: React + Vite + TypeScript, Tailwind CSS, shadcn/ui
- Testing: Jest/Supertest (backend), Vitest/RTL + Playwright (frontend)
- Docker: docker-compose for MySQL, API, and frontend

## Project Structure

```
Project_Management_Tool/
├─ backend/
│  ├─ src/
│  │  ├─ controllers/ middleware/ models/ routes/ services/ utils/ config/
│  │  └─ scripts/ (migrate.js, seed.js)
│  ├─ database/
│  │  ├─ migrations/ (base SQL)
│  │  └─ seeds/
│  └─ tests/
├─ frontend/
│  ├─ src/ (components, pages, hooks, services, contexts, types)
│  └─ e2e/ (Playwright)
├─ docker-compose.yml
├─ postman_collection.json
└─ postman_environment.json
```

## Prerequisites

- Node.js 18 or newer
- MySQL 8+
- npm (comes with Node.js)
- Optional: Docker Desktop (Windows/macOS)

## Environment Variables

### Backend (`backend/.env`)
The backend already includes a sample `.env`. Open `backend/.env` and verify/update:

```
NODE_ENV=development
PORT=5000

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=project_management_tool
DB_USER=root
DB_PASSWORD=your_mysql_password

# JWT
JWT_SECRET=please_generate_a_strong_secret_at_least_32_chars
JWT_REFRESH_SECRET=another_strong_secret
JWT_EXPIRES_IN=7d

# AI (optional)
GROQ_API_KEY=

# CORS
FRONTEND_URL=http://localhost:5173

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

Note: When running with Docker, prefer setting `FRONTEND_URL` for CORS. The application reads `FRONTEND_URL` (not `CORS_ORIGIN`).

### Frontend (`frontend/.env`)
Create a `.env` file in `frontend/` if missing:

```
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Project_Management_Tool
VITE_APP_VERSION=1.0.0
```

## Local Development (Windows PowerShell examples)

1) Install dependencies

```powershell
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd ../frontend
npm install
```

2) Create database and run migrations

```powershell
# Create the database (first time only; requires MySQL in PATH)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS project_management_tool;"

# Run migrations and optional seeds
cd ../backend
npm run migrate
npm run seed   # optional
```

3) Start the apps

```powershell
# Backend (http://localhost:5000)
cd backend
npm run dev

# Frontend (http://localhost:5173)
cd ../frontend
npm run dev
```

Backend API base URL: http://localhost:5000/api

## Run with Docker

```powershell
docker compose up -d --build
```

Services:
- MySQL: localhost:3306 (container: project-mgmt-db)
- API: http://localhost:5000 (container: project-mgmt-backend)
- Frontend: http://localhost:5173 (container: project-mgmt-frontend)

Database initialization: `docker-compose.yml` mounts `backend/database/migrations` to the MySQL init folder, so the base schema applies on the first run. To seed data with Docker:

```powershell
docker exec -it project-mgmt-backend npm run seed
```

Tip (CORS in Docker): ensure the backend sees `FRONTEND_URL=http://localhost:5173`. You can add it under the `backend.environment` section in `docker-compose.yml`.

## Testing

```powershell
# Backend unit/integration tests
cd backend
npm test

# Frontend unit tests
cd ../frontend
npm test

# Frontend E2E tests (requires app running or let Playwright start it)
npm run test:e2e
```

## Postman

- Import `postman_collection.json` and `postman_environment.json` from the repo root.
- Update the environment base URL to `http://localhost:5000/api` if needed.

## Notable API Endpoints

- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Users: `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`
- Projects: `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`, `POST /api/projects/:id/members`
- Tasks: `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/:id`, `POST /api/tasks/:id/comments`
- Dashboard: `GET /api/dashboard/stats`, `GET /api/dashboard/overdue`, `GET /api/dashboard/progress/:projectId`

## Scripts quick reference

Backend (`/backend/package.json`):
- `npm run dev` – start API in watch mode
- `npm start` – start API
- `npm run migrate` – run DB migrations
- `npm run seed` – seed sample data
- `npm test` – run Jest tests

Frontend (`/frontend/package.json`):
- `npm run dev` – start Vite dev server
- `npm run build` – type-check + build
- `npm run preview` – preview built site
- `npm test` – run unit tests
- `npm run test:e2e` – Playwright E2E tests

## Troubleshooting

- CORS blocked: ensure backend `FRONTEND_URL` matches your frontend origin (e.g., `http://localhost:5173`). For Docker, set this in `docker-compose.yml` under the backend service.
- DB connection refused: verify MySQL is running and credentials in `backend/.env` match your server.
- Port in use: change `PORT` in `backend/.env` or Vite port with `--port` (e.g., `npm run dev -- --port 5174`). Update `VITE_API_URL` accordingly.
- JWT errors: use strong `JWT_SECRET` (≥32 chars) and restart the API after changes.

## Database Schema

See `docs/er-diagram/` for the ER diagram.

## Contributing

1) Create a feature branch
2) Make your changes with tests
3) Open a pull request

## Contact Me

- Email: mahulearchit@gmail.com
- Phone: 8766973101
