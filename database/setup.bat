@echo off
setlocal enabledelayedexpansion

:: Project Management Tool Database Setup Script (Windows)
:: This script creates the database, runs migrations, and seeds sample data

title Project Management Tool - Database Setup

echo.
echo ========================================
echo   Project Management Tool Database Setup
echo ========================================
echo.

:: Database configuration (update these values or set as environment variables)
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=3306
if "%DB_USER%"=="" set DB_USER=root
if "%DB_PASSWORD%"=="" set DB_PASSWORD=
set DB_NAME=project_management_tool

echo Database Configuration:
echo   Host: %DB_HOST%:%DB_PORT%
echo   User: %DB_USER%
echo   Database: %DB_NAME%
echo.

:: Get script directory
set SCRIPT_DIR=%~dp0
set MIGRATIONS_DIR=%SCRIPT_DIR%migrations
set SEEDS_DIR=%SCRIPT_DIR%seeds

:: Function to check if file exists and execute
goto :check_mysql

:execute_sql
set "file=%~1"
set "description=%~2"
echo [INFO] Executing: %description%
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% < "%file%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed: %description%
    pause
    exit /b 1
) else (
    echo [SUCCESS] Completed: %description%
)
goto :eof

:check_mysql
echo [INFO] Checking MySQL connection...
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% -e "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] MySQL connection failed. Please check your credentials.
    echo.
    echo Make sure:
    echo   1. MySQL is running
    echo   2. Credentials are correct
    echo   3. MySQL client is in your PATH
    pause
    exit /b 1
) else (
    echo [SUCCESS] MySQL connection successful
)

echo.
echo ========================================
echo   Running Database Migrations
echo ========================================

:: Execute base migration
if exist "%MIGRATIONS_DIR%\001_create_database.sql" (
    call :execute_sql "%MIGRATIONS_DIR%\001_create_database.sql" "Creating base database schema"
) else (
    echo [ERROR] Base migration file not found: %MIGRATIONS_DIR%\001_create_database.sql
    pause
    exit /b 1
)

:: Execute enhanced migration
if exist "%MIGRATIONS_DIR%\002_enhanced_schema.sql" (
    call :execute_sql "%MIGRATIONS_DIR%\002_enhanced_schema.sql" "Applying enhanced schema features"
) else (
    echo [WARNING] Enhanced schema file not found, skipping...
)

echo.
echo ========================================
echo   Seeding Sample Data
echo ========================================

if exist "%SEEDS_DIR%\sample_data.sql" (
    set /p "choice=Do you want to insert sample data? (y/N): "
    if /i "!choice!"=="y" (
        call :execute_sql "%SEEDS_DIR%\sample_data.sql" "Inserting sample data"
    ) else (
        echo [INFO] Skipping sample data insertion
    )
) else (
    echo [WARNING] Sample data file not found, skipping...
)

echo.
echo ========================================
echo   Verifying Installation
echo ========================================

echo [INFO] Checking database tables...

:: Create a temporary file to store table count
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% -D%DB_NAME% -e "SHOW TABLES;" > temp_tables.txt 2>nul

if %errorlevel% neq 0 (
    echo [ERROR] Could not verify database installation
    if exist temp_tables.txt del temp_tables.txt
    pause
    exit /b 1
)

:: Count lines (subtract 1 for header)
for /f %%i in ('type temp_tables.txt ^| find /c /v ""') do set TABLE_COUNT=%%i
set /a TABLE_COUNT=%TABLE_COUNT%-1

if %TABLE_COUNT% gtr 0 (
    echo [SUCCESS] Database has %TABLE_COUNT% tables
    echo.
    echo Created Tables:
    for /f "skip=1 tokens=*" %%a in (temp_tables.txt) do echo   • %%a
    
    echo.
    echo Created Views:
    mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASSWORD% -D%DB_NAME% -e "SHOW FULL TABLES WHERE Table_type = 'VIEW';" | findstr /v "Tables_in"
    
) else (
    echo [ERROR] Database setup failed - no tables found
    if exist temp_tables.txt del temp_tables.txt
    pause
    exit /b 1
)

:: Cleanup
if exist temp_tables.txt del temp_tables.txt

echo.
echo ========================================
echo   Setup Completed Successfully!
echo ========================================
echo.
echo Database Details:
echo   • Host: %DB_HOST%:%DB_PORT%
echo   • Database: %DB_NAME%
echo   • User: %DB_USER%
echo.
echo Next Steps:
echo   1. Update your .env file with database credentials
echo   2. Test the connection from your application
echo   3. Start developing your project management features
echo.
echo Tip: You can re-run this script anytime to reset the database
echo.
pause