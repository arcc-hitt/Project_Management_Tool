# Project Management Tool - Database Setup

This directory contains all the database-related files for the Project Management Tool, including schema migrations, sample data, and setup scripts.

## 📁 Directory Structure

```
database/
├── migrations/
│   ├── 001_create_database.sql      # Base database schema
│   └── 002_enhanced_schema.sql      # Enhanced features and optimizations
├── seeds/
│   └── sample_data.sql              # Sample data for testing
├── setup.sh                        # Linux/macOS setup script
├── setup.bat                       # Windows batch setup script
├── setup.ps1                       # Windows PowerShell setup script
└── README.md                       # This file
```

## 🗄️ Database Schema Overview

### Core Tables
- **users** - User accounts with role-based access
- **projects** - Project information and metadata
- **project_members** - Project team assignments (many-to-many)
- **tasks** - Task management with status and priority
- **task_comments** - Collaboration comments on tasks
- **notifications** - System notifications

### Enhanced Tables
- **activity_logs** - Comprehensive activity tracking
- **project_files** - File attachments for projects/tasks
- **time_entries** - Time tracking for tasks
- **project_templates** - Reusable project templates
- **user_preferences** - User-specific settings
- **api_tokens** - API access tokens for integrations
- **user_stories** - AI-generated user stories (future feature)
- **task_dependencies** - Task dependency management

### Views
- **detailed_project_stats** - Enhanced project statistics
- **user_productivity_stats** - User productivity metrics
- **task_activity_summary** - Recent task activities

### Features
- 🔄 **Automatic triggers** for progress calculation
- 📊 **Optimized indexes** for performance
- 🔒 **Foreign key constraints** for data integrity
- 📝 **Activity logging** for audit trails
- ⏰ **Automatic timestamps** for tracking changes

## 🚀 Quick Setup

### Prerequisites
- MySQL 8.0+ or MariaDB 10.3+
- MySQL client tools installed
- Database user with CREATE DATABASE privileges

### Option 1: PowerShell (Recommended for Windows)
```powershell
# Navigate to the database directory
cd database

# Run the PowerShell setup script
.\setup.ps1

# Optional: Skip sample data
.\setup.ps1 -SkipSampleData

# Custom database connection
.\setup.ps1 -Host "localhost" -Port "3306" -User "myuser" -Password "mypass"
```

### Option 2: Batch File (Windows)
```cmd
cd database
setup.bat
```

### Option 3: Bash Script (Linux/macOS)
```bash
cd database
chmod +x setup.sh
./setup.sh
```

### Option 4: Manual Setup
```sql
-- Execute files in order:
mysql -u root -p < migrations/001_create_database.sql
mysql -u root -p < migrations/002_enhanced_schema.sql
mysql -u root -p < seeds/sample_data.sql  # Optional
```

## ⚙️ Configuration

### Environment Variables
Set these environment variables before running setup scripts:

```bash
# Database connection
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password

# For PowerShell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_USER="root"
$env:DB_PASSWORD="your_password"
```

### Application Configuration
Update your `.env` file in the backend directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=project_management_tool

# Connection pool settings
DB_CONNECTION_LIMIT=10
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000
```

## 🧪 Sample Data

The sample data includes:
- **5 Users** with different roles (admin, manager, developers)
- **3 Projects** with various statuses
- **Project team assignments**
- **Sample tasks** with different priorities and statuses
- **Task comments** for collaboration examples

### Default Login Credentials
All sample users have the password: `password123`

- **Admin**: admin@example.com
- **Manager**: john.manager@example.com  
- **Developers**: sarah.dev@example.com, mike.dev@example.com, jane.dev@example.com

⚠️ **Security Note**: Change these passwords in production!

## 🔧 Maintenance

### Reset Database
To completely reset the database, re-run any setup script. It will:
1. Drop existing database (if exists)
2. Create fresh schema
3. Apply all migrations
4. Optionally seed sample data

### Add New Migration
1. Create new file: `migrations/003_your_feature.sql`
2. Update setup scripts to include the new migration
3. Run setup script to apply changes

### Backup Database
```bash
# Create backup
mysqldump -u root -p project_management_tool > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
mysql -u root -p project_management_tool < backup_file.sql
```

## 📊 Performance Optimization

The schema includes several optimizations:

### Indexes
- Primary keys on all tables
- Foreign key indexes for relationships
- Composite indexes for common query patterns
- Covering indexes for frequently accessed columns

### Triggers
- Automatic project progress calculation
- Activity logging for audit trails
- Timestamp management for task completion

### Views
- Pre-aggregated statistics for dashboards
- Optimized queries for common reporting needs

## 🐛 Troubleshooting

### Common Issues

**MySQL Connection Failed**
- Verify MySQL is running: `systemctl status mysql` (Linux) or check Services (Windows)
- Check credentials and permissions
- Ensure MySQL client is in PATH

**Permission Denied**
- Ensure database user has CREATE DATABASE privileges
- Grant necessary permissions: `GRANT ALL PRIVILEGES ON project_management_tool.* TO 'user'@'localhost';`

**Script Execution Failed**
- Check file permissions: `chmod +x setup.sh`
- Verify script encoding (UTF-8)
- Run with appropriate shell/interpreter

**Foreign Key Constraint Errors**
- Ensure referential integrity in sample data
- Check for circular dependencies
- Verify parent records exist before creating children

### Getting Help

1. **Check MySQL Error Log**: Usually in `/var/log/mysql/` or MySQL data directory
2. **Enable Query Logging**: Add `general_log=1` to MySQL config
3. **Test Connection**: Use MySQL client to verify connectivity
4. **Review Script Output**: Scripts provide detailed status messages

## 🔄 Migration Strategy

For production deployments:

1. **Backup** existing data
2. **Test migrations** in staging environment
3. **Apply migrations** during maintenance window
4. **Verify data integrity** after migration
5. **Monitor performance** post-migration

## 📈 Monitoring

Recommended monitoring queries:

```sql
-- Check table sizes
SELECT 
    table_name, 
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'project_management_tool';

-- Check slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

-- Check active connections
SHOW PROCESSLIST;
```

---

## 📝 Notes

- All timestamps are stored in UTC
- JSON columns require MySQL 5.7.8+ or MariaDB 10.2.7+
- Triggers require appropriate MySQL privileges
- Views are automatically updated when underlying data changes

For questions or issues, please refer to the project documentation or create an issue in the repository.