# Project Management Tool Database Setup Script (PowerShell)
# This script creates the database, runs migrations, and seeds sample data

param(
    [string]$Host = $env:DB_HOST ?? "localhost",
    [string]$Port = $env:DB_PORT ?? "3306", 
    [string]$User = $env:DB_USER ?? "root",
    [string]$Password = $env:DB_PASSWORD ?? "",
    [switch]$SkipSampleData
)

$DatabaseName = "project_management_tool"

# Colors for output
$Colors = @{
    Info = "Cyan"
    Success = "Green" 
    Warning = "Yellow"
    Error = "Red"
}

function Write-ColoredOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Execute-SqlFile {
    param([string]$FilePath, [string]$Description)
    
    Write-ColoredOutput "📄 Executing: $Description" "Info"
    
    try {
        $arguments = @(
            "-h$Host",
            "-P$Port", 
            "-u$User"
        )
        
        if ($Password) {
            $arguments += "-p$Password"
        }
        
        $process = Start-Process -FilePath "mysql" -ArgumentList $arguments -RedirectStandardInput $FilePath -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColoredOutput "✅ Success: $Description" "Success"
            return $true
        } else {
            Write-ColoredOutput "❌ Failed: $Description" "Error"
            return $false
        }
    }
    catch {
        Write-ColoredOutput "❌ Error executing $Description`: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Test-MySqlConnection {
    try {
        $arguments = @(
            "-h$Host",
            "-P$Port",
            "-u$User"
        )
        
        if ($Password) {
            $arguments += "-p$Password"
        }
        
        $arguments += @("-e", "SELECT 1;")
        
        $process = Start-Process -FilePath "mysql" -ArgumentList $arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $null -RedirectStandardError $null
        return $process.ExitCode -eq 0
    }
    catch {
        return $false
    }
}

# Main script
Clear-Host
Write-Host ""
Write-ColoredOutput "🚀 Project Management Tool Database Setup" "Info"
Write-Host "================================================"
Write-Host ""

Write-Host "Database Configuration:"
Write-Host "  Host: $Host`:$Port"
Write-Host "  User: $User"
Write-Host "  Database: $DatabaseName"
Write-Host ""

# Check MySQL connection
Write-ColoredOutput "🔍 Checking MySQL connection..." "Info"
if (Test-MySqlConnection) {
    Write-ColoredOutput "✅ MySQL connection successful" "Success"
} else {
    Write-ColoredOutput "❌ MySQL connection failed. Please check:" "Error"
    Write-Host "  1. MySQL is running"
    Write-Host "  2. Credentials are correct" 
    Write-Host "  3. MySQL client is in your PATH"
    Read-Host "Press Enter to exit"
    exit 1
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MigrationsDir = Join-Path $ScriptDir "migrations"
$SeedsDir = Join-Path $ScriptDir "seeds"

# Execute migrations
Write-Host ""
Write-ColoredOutput "📦 Running Database Migrations" "Info"
Write-Host "======================================="

$baseMigration = Join-Path $MigrationsDir "001_create_database.sql"
if (Test-Path $baseMigration) {
    if (-not (Execute-SqlFile $baseMigration "Creating base database schema")) {
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-ColoredOutput "❌ Base migration file not found: $baseMigration" "Error"
    Read-Host "Press Enter to exit"
    exit 1
}

$enhancedMigration = Join-Path $MigrationsDir "002_enhanced_schema.sql"
if (Test-Path $enhancedMigration) {
    Execute-SqlFile $enhancedMigration "Applying enhanced schema features" | Out-Null
} else {
    Write-ColoredOutput "⚠️  Enhanced schema file not found, skipping..." "Warning"
}

# Seed sample data
Write-Host ""
Write-ColoredOutput "🌱 Seeding Sample Data" "Info"
Write-Host "========================="

$sampleDataFile = Join-Path $SeedsDir "sample_data.sql"
if (Test-Path $sampleDataFile) {
    if (-not $SkipSampleData) {
        $choice = Read-Host "Do you want to insert sample data? (y/N)"
        if ($choice -eq 'y' -or $choice -eq 'Y') {
            Execute-SqlFile $sampleDataFile "Inserting sample data" | Out-Null
        } else {
            Write-ColoredOutput "⏭️  Skipping sample data insertion" "Warning"
        }
    } else {
        Write-ColoredOutput "⏭️  Skipping sample data insertion (parameter specified)" "Warning"
    }
} else {
    Write-ColoredOutput "⚠️  Sample data file not found, skipping..." "Warning"
}

# Verify installation
Write-Host ""
Write-ColoredOutput "🔍 Verifying Installation" "Info"
Write-Host "==========================="

Write-ColoredOutput "📊 Checking database tables..." "Info"

try {
    $arguments = @(
        "-h$Host",
        "-P$Port",
        "-u$User"
    )
    
    if ($Password) {
        $arguments += "-p$Password"
    }
    
    $arguments += @("-D$DatabaseName", "-e", "SHOW TABLES;")
    
    $tablesOutput = & mysql $arguments 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $tableCount = ($tablesOutput | Where-Object { $_ -and $_ -notmatch "Tables_in_" }).Count
        
        if ($tableCount -gt 0) {
            Write-ColoredOutput "✅ Database has $tableCount tables" "Success"
            
            Write-Host ""
            Write-ColoredOutput "📋 Created Tables:" "Info"
            $tablesOutput | Where-Object { $_ -and $_ -notmatch "Tables_in_" } | ForEach-Object { Write-Host "  • $_" }
            
            # Show views
            $arguments[-1] = "SHOW FULL TABLES WHERE Table_type = 'VIEW';"
            $viewsOutput = & mysql $arguments 2>$null
            
            Write-Host ""
            Write-ColoredOutput "👁️  Created Views:" "Info"
            $viewsOutput | Where-Object { $_ -and $_ -notmatch "Tables_in_" } | ForEach-Object { 
                $parts = $_ -split '\s+'
                if ($parts.Length -gt 0) {
                    Write-Host "  • $($parts[0])"
                }
            }
        } else {
            Write-ColoredOutput "❌ Database setup failed - no tables found" "Error"
            Read-Host "Press Enter to exit"
            exit 1
        }
    } else {
        Write-ColoredOutput "❌ Could not verify database installation" "Error"
        Read-Host "Press Enter to exit"
        exit 1
    }
}
catch {
    Write-ColoredOutput "❌ Error verifying installation: $($_.Exception.Message)" "Error"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-ColoredOutput "🎉 Database setup completed successfully!" "Success"
Write-Host "=========================================="
Write-ColoredOutput "Database Details:" "Info"
Write-Host "  • Host: $Host`:$Port"
Write-Host "  • Database: $DatabaseName"
Write-Host "  • User: $User"
Write-Host ""
Write-ColoredOutput "Next Steps:" "Info"
Write-Host "  1. Update your .env file with database credentials"
Write-Host "  2. Test the connection from your application"
Write-Host "  3. Start developing your project management features"
Write-Host ""
Write-ColoredOutput "💡 Tip: You can re-run this script anytime to reset the database" "Warning"
Write-Host ""
Read-Host "Press Enter to continue"