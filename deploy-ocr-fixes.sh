#!/bin/bash
# deploy-ocr-fixes.sh - Script to deploy OCR fixes to production

echo "🚀 Deploying OCR Fixes for Medical Bills"
echo "======================================"

# Configuration
BACKUP_DIR="/home/rayyan9477/ocr-app/backups/$(date +%Y%m%d-%H%M%S)"
LOG_FILE="deploy-$(date +%Y%m%d-%H%M%S).log"
REPO_URL=${REPO_URL:-""}  # Set this to your git repo URL if using git
BRANCH=${BRANCH:-"master"}
RESTART_SERVICES=${RESTART_SERVICES:-"true"}

# Function to log messages with timestamps
log() {
  local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$message" | tee -a "$LOG_FILE"
}

# Create backup directories
create_backups() {
  log "Creating backup directory: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR/lib"
  mkdir -p "$BACKUP_DIR/app/api/ocr"
  mkdir -p "$BACKUP_DIR/config"
  mkdir -p "$BACKUP_DIR/scripts"
  
  # Backup key files
  log "Backing up current files..."
  cp -p /home/rayyan9477/ocr-app/lib/ocr-enhancement.ts "$BACKUP_DIR/lib/"
  cp -p /home/rayyan9477/ocr-app/lib/ocr-retry.ts "$BACKUP_DIR/lib/"
  cp -p /home/rayyan9477/ocr-app/lib/ocr-output-helper.ts "$BACKUP_DIR/lib/"
  cp -p /home/rayyan9477/ocr-app/lib/diacritic-handler.ts "$BACKUP_DIR/lib/"
  cp -p /home/rayyan9477/ocr-app/lib/empty-page-handler.ts "$BACKUP_DIR/lib/"
  cp -p /home/rayyan9477/ocr-app/app/api/ocr/route.ts "$BACKUP_DIR/app/api/ocr/"
  cp -p /home/rayyan9477/ocr-app/config/medical_config.cfg "$BACKUP_DIR/config/"
  
  log "Backed up files to $BACKUP_DIR"
}

# Deploy updated scripts
deploy_scripts() {
  log "Deploying updated scripts..."
  
  # Make scripts executable
  chmod +x /home/rayyan9477/ocr-app/fix-ocr-medical.sh
  chmod +x /home/rayyan9477/ocr-app/reprocess-medical-bill.sh
  chmod +x /home/rayyan9477/ocr-app/monitor-ocr-processing.sh
  
  log "Scripts deployed and made executable"
}

# Check dependencies
check_dependencies() {
  log "Checking OCRmyPDF installation..."
  if ! command -v ocrmypdf &> /dev/null; then
    log "ERROR: OCRmyPDF not found! Please install it first."
    exit 1
  fi
  
  ocrmypdf_version=$(ocrmypdf --version | head -n 1)
  log "OCRmyPDF version: $ocrmypdf_version"
  
  log "Checking other dependencies..."
  for cmd in pdftoppm pdfinfo identify imagemagick tesseract; do
    if ! command -v $cmd &> /dev/null; then
      log "WARNING: $cmd not found. Some functionality may be limited."
    else
      log "✅ $cmd installed"
    fi
  done
}

# Set proper permissions
set_permissions() {
  log "Setting proper permissions..."
  
  # Ensure upload and processing directories have proper permissions
  mkdir -p /home/rayyan9477/ocr-app/uploads
  mkdir -p /home/rayyan9477/ocr-app/processed
  mkdir -p /home/rayyan9477/ocr-app/tmp
  mkdir -p /home/rayyan9477/ocr-app/logs
  
  chmod -R 777 /home/rayyan9477/ocr-app/uploads
  chmod -R 777 /home/rayyan9477/ocr-app/processed
  chmod -R 777 /home/rayyan9477/ocr-app/tmp
  chmod -R 777 /home/rayyan9477/ocr-app/logs
  
  log "Permissions set"
}

# Run tests to verify deployment
run_tests() {
  log "Running tests to verify deployment..."
  
  # Run the test script
  if /home/rayyan9477/ocr-app/test-ocr-system.sh; then
    log "✅ OCR system tests passed"
  else
    log "❌ OCR system tests failed!"
    log "Check test output for details. Continuing deployment but verification failed."
  fi
  
  # Try processing a medical bill as an additional test
  log "Testing medical bill processing..."
  
  # Find a test medical bill
  test_file=""
  for f in /home/rayyan9477/ocr-app/uploads/*.pdf; do
    if [ -f "$f" ]; then
      test_file="$f"
      break
    fi
  done
  
  if [ -n "$test_file" ]; then
    log "Testing with file: $test_file"
    
    if /home/rayyan9477/ocr-app/fix-ocr-medical.sh; then
      log "✅ Medical bill processing test passed"
    else
      log "❌ Medical bill processing test failed!"
      log "Check test output for details. Continuing deployment but verification failed."
    fi
  else
    log "No test files found. Skipping medical bill test."
  fi
}

# Restart services if needed
restart_services() {
  if [ "$RESTART_SERVICES" = "true" ]; then
    log "Restarting services..."
    
    # Check if running in Docker
    if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup; then
      log "Running in Docker environment"
      
      # Use Docker-specific commands
      if command -v docker &> /dev/null; then
        log "Restarting container..."
        docker restart $(hostname) || log "Failed to restart container"
      else
        log "Docker command not found. Trying service restart..."
        systemctl restart ocr-app.service || log "Failed to restart service"
      fi
    else
      # Traditional service restart
      log "Running in traditional environment"
      
      # Try different service managers
      if command -v systemctl &> /dev/null; then
        systemctl restart ocr-app.service || log "Failed to restart with systemctl"
      elif command -v service &> /dev/null; then
        service ocr-app restart || log "Failed to restart with service"
      else
        log "No known service manager found. Manual restart may be required."
      fi
    fi
    
    log "Service restart attempted"
  else
    log "Service restart skipped (RESTART_SERVICES=false)"
  fi
}

# Set up monitoring
setup_monitoring() {
  log "Setting up monitoring..."
  
  # Add a cron job for the monitoring script if it doesn't exist
  if ! crontab -l | grep -q "monitor-ocr-processing.sh"; then
    log "Adding monitoring cron job"
    
    # Write current crontab to temporary file
    crontab -l > /tmp/current_crontab 2>/dev/null || echo "" > /tmp/current_crontab
    
    # Add our cron job for every hour
    echo "0 * * * * /home/rayyan9477/ocr-app/monitor-ocr-processing.sh >> /home/rayyan9477/ocr-app/logs/monitor.log 2>&1" >> /tmp/current_crontab
    
    # Install the new crontab
    crontab /tmp/current_crontab
    rm /tmp/current_crontab
    
    log "Monitoring cron job added"
  else
    log "Monitoring cron job already exists"
  fi
}

# Main execution
log "========================="
log "Starting deployment"
log "========================="

# Create backups before making changes
create_backups

# Check dependencies 
check_dependencies

# Deploy updated scripts
deploy_scripts

# Set proper permissions
set_permissions

# Run tests
run_tests

# Set up monitoring
setup_monitoring

# Restart services if needed
restart_services

log "========================="
log "Deployment completed"
log "========================="

echo "Deployment completed. See log at: $LOG_FILE"
