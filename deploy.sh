#!/bin/bash

# Project Management Tool Deployment Script
# This script builds and deploys the application using    # Create development .env file
    cat > .env << EOL
NODE_ENV=development
DB_HOST=mysql
DB_PORT=3306
DB_NAME=project_management_tool
DB_USER=project_user
DB_PASSWORD=user_password123
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:3000
REDIS_URL=redis://redis:6379
EOLet -e  # Exit on any error

echo "Starting Project Management Tool Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Parse command line arguments
ENVIRONMENT="development"
BUILD_FRONTEND=true
BUILD_BACKEND=true
RUN_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-frontend)
            BUILD_FRONTEND=false
            shift
            ;;
        --skip-backend)
            BUILD_BACKEND=false
            shift
            ;;
        --test)
            RUN_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --env ENVIRONMENT    Set environment (development|production) [default: development]"
            echo "  --skip-frontend      Skip building frontend"
            echo "  --skip-backend       Skip building backend"
            echo "  --test               Run tests before deployment"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status "Deployment Environment: $ENVIRONMENT"

# Create environment-specific .env file
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Setting up production environment..."
    
    # Create production .env file
    cat > .env << EOL
NODE_ENV=production
DB_HOST=mysql
DB_PORT=3306
DB_NAME=project_management_tool
DB_USER=project_user
DB_PASSWORD=user_password123
JWT_SECRET=your-super-secret-jwt-key-change-in-production-$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:3000
REDIS_URL=redis://redis:6379
EOL

    print_warning "Please update the JWT_SECRET and other sensitive variables in .env file!"
else
    print_status "Setting up development environment..."
    
    # Create development .env file
    cat > .env << EOL
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password123@postgres:5432/project_management
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:5173
REDIS_URL=redis://redis:6379
EOL
fi

# Run tests if requested
if [ "$RUN_TESTS" = true ]; then
    print_status "Running tests..."
    
    if [ "$BUILD_FRONTEND" = true ]; then
        print_status "Running frontend tests..."
        cd frontend
        npm ci
        npm run test -- --run
        npm run lint
        cd ..
        print_success "Frontend tests passed!"
    fi
    
    if [ "$BUILD_BACKEND" = true ]; then
        print_status "Running backend tests..."
        cd backend
        npm ci
        npm run test
        npm run lint
        cd ..
        print_success "Backend tests passed!"
    fi
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down

# Remove old images if in production
if [ "$ENVIRONMENT" = "production" ]; then
    print_status "Cleaning up old images..."
    docker image prune -f
fi

# Build and start services
print_status "Building and starting services..."

if [ "$BUILD_FRONTEND" = true ] && [ "$BUILD_BACKEND" = true ]; then
    docker-compose up --build -d
elif [ "$BUILD_FRONTEND" = true ]; then
    docker-compose up --build -d frontend
elif [ "$BUILD_BACKEND" = true ]; then
    docker-compose up --build -d backend mysql redis
else
    docker-compose up -d
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check if services are running
print_status "Checking service health..."

# Check MySQL
if docker-compose exec -T mysql mysqladmin ping -h localhost -u project_user -puser_password123 > /dev/null 2>&1; then
    print_success "MySQL is ready"
else
    print_error "MySQL is not ready"
fi

# Check Backend
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    print_success "Backend is ready"
else
    print_warning "Backend health check failed (this might be normal if health endpoint is not implemented)"
fi

# Check Frontend
if curl -f http://localhost:5173 > /dev/null 2>&1; then
    print_success "Frontend is ready"
else
    print_warning "Frontend is not responding (this might take a few more seconds)"
fi

# Show running containers
print_status "Running containers:"
docker-compose ps

# Show logs command
print_status "Deployment completed!"
print_success "Frontend: http://localhost:5173"
print_success "Backend API: http://localhost:5000"
print_success "Database: localhost:3306"

echo ""
print_status "To view logs, run:"
echo "  docker-compose logs -f [service_name]"
echo ""
print_status "To stop all services, run:"
echo "  docker-compose down"
echo ""
print_status "To rebuild and restart, run:"
echo "  $0 --env $ENVIRONMENT"