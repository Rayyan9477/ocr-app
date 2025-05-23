#!/bin/bash
# monitor-ocr-processing.sh - Script to monitor OCR processing and detect failures

echo "🔍 OCR Processing Monitor"
echo "======================="

# Configuration
LOGS_DIR="/home/rayyan9477/ocr-app/logs"
UPLOADS_DIR="/home/rayyan9477/ocr-app/uploads"
PROCESSED_DIR="/home/rayyan9477/ocr-app/processed"
EMAIL_ALERTS=${EMAIL_ALERTS:-"false"}
EMAIL_RECIPIENT=${EMAIL_RECIPIENT:-"admin@example.com"}
MAX_PROCESSING_TIME=${MAX_PROCESSING_TIME:-300} # 5 minutes
ALERT_THRESHOLD=${ALERT_THRESHOLD:-5} # Number of failures before alerting

# Ensure log directory exists
mkdir -p "$LOGS_DIR"
MONITOR_LOG="$LOGS_DIR/ocr_monitor_$(date +%Y%m%d).log"

# Function to log messages
log() {
  local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$message" | tee -a "$MONITOR_LOG"
}

# Function to send email alerts
send_alert() {
  local subject="$1"
  local body="$2"
  
  if [ "$EMAIL_ALERTS" = "true" ]; then
    log "Sending email alert: $subject"
    echo "$body" | mail -s "$subject" "$EMAIL_RECIPIENT"
  else
    log "Email alerts disabled. Alert would have been: $subject"
  fi
}

# Find pending files (in uploads but not in processed)
find_pending_files() {
  log "Checking for pending files..."
  
  local count=0
  local pending_files=()
  
  for upload in "$UPLOADS_DIR"/*.pdf; do
    # Skip if no matches found
    [ -e "$upload" ] || continue
    
    filename=$(basename "$upload" .pdf)
    processed_found=false
    
    # Check if any matching processed file exists
    for processed in "$PROCESSED_DIR/${filename}"*; do
      if [ -e "$processed" ]; then
        processed_found=true
        break
      fi
    done
    
    if [ "$processed_found" = false ]; then
      pending_files+=("$upload")
      count=$((count+1))
    fi
  done
  
  log "Found $count pending files"
  
  if [ ${#pending_files[@]} -gt 0 ]; then
    local list=""
    for file in "${pending_files[@]}"; do
      list="$list\n- $(basename "$file")"
    done
    
    log "Pending files:$list"
    
    if [ ${#pending_files[@]} -gt "$ALERT_THRESHOLD" ]; then
      send_alert "OCR Processing Backlog Alert" "There are ${#pending_files[@]} files pending OCR processing:\n$list"
    fi
  fi
}

# Check for stalled processing (files older than MAX_PROCESSING_TIME without output)
check_stalled_files() {
  log "Checking for stalled processing..."
  
  local count=0
  local threshold_seconds=$MAX_PROCESSING_TIME
  local now=$(date +%s)
  local stalled_files=()
  
  for upload in "$UPLOADS_DIR"/*.pdf; do
    # Skip if no matches found
    [ -e "$upload" ] || continue
    
    # Get file modification time in seconds
    file_time=$(stat -c %Y "$upload")
    elapsed=$((now - file_time))
    
    if [ $elapsed -gt $threshold_seconds ]; then
      filename=$(basename "$upload" .pdf)
      processed_found=false
      
      # Check if any matching processed file exists
      for processed in "$PROCESSED_DIR/${filename}"*; do
        if [ -e "$processed" ]; then
          processed_found=true
          break
        fi
      done
      
      if [ "$processed_found" = false ]; then
        stalled_files+=("$upload ($elapsed seconds)")
        count=$((count+1))
      fi
    fi
  done
  
  log "Found $count stalled files"
  
  if [ ${#stalled_files[@]} -gt 0 ]; then
    local list=""
    for file in "${stalled_files[@]}"; do
      list="$list\n- $file"
    done
    
    log "Stalled files:$list"
    
    if [ ${#stalled_files[@]} -gt 0 ]; then
      send_alert "OCR Processing Stalled Files Alert" "There are ${#stalled_files[@]} files with stalled OCR processing:\n$list"
    fi
  fi
}

# Check for fallback files (OCR failures)
check_fallback_files() {
  log "Checking for fallback files (OCR failures)..."
  
  local count=0
  local fallback_files=()
  
  for fallback in "$PROCESSED_DIR"/*_fallback_*.pdf; do
    # Skip if no matches found
    [ -e "$fallback" ] || continue
    
    creation_time=$(stat -c %y "$fallback")
    fallback_files+=("$(basename "$fallback") ($creation_time)")
    count=$((count+1))
  done
  
  log "Found $count fallback files"
  
  if [ ${#fallback_files[@]} -gt 0 ]; then
    local list=""
    for file in "${fallback_files[@]}"; do
      list="$list\n- $file"
    done
    
    log "Recent fallback files:$list"
    
    if [ ${#fallback_files[@]} -gt "$ALERT_THRESHOLD" ]; then
      send_alert "OCR Processing Fallback Alert" "There are ${#fallback_files[@]} recent OCR fallbacks (processing failures):\n$list"
    fi
  fi
}

# Check disk space
check_disk_space() {
  log "Checking disk space..."
  
  # Get disk usage percentage for uploads directory
  local disk_usage=$(df -h "$UPLOADS_DIR" | awk 'NR==2 {print $5}' | tr -d '%')
  
  log "Current disk usage: ${disk_usage}%"
  
  if [ "$disk_usage" -gt 85 ]; then
    send_alert "OCR Processing Disk Space Alert" "Disk usage is at ${disk_usage}%, which is critically high. Please free up space."
  elif [ "$disk_usage" -gt 75 ]; then
    send_alert "OCR Processing Disk Space Warning" "Disk usage is at ${disk_usage}%, approaching critical levels."
  fi
}

# Run all checks
run_monitoring() {
  log "Starting OCR processing monitoring"
  
  find_pending_files
  check_stalled_files
  check_fallback_files
  check_disk_space
  
  log "Monitoring completed"
}

# Try to reprocess recent failures automatically
reprocess_recent_failures() {
  log "Attempting to reprocess recent failures..."
  
  local count=0
  local success_count=0
  local recent_threshold=86400  # Last 24 hours
  local now=$(date +%s)
  
  for fallback in "$PROCESSED_DIR"/*_fallback_*.pdf; do
    # Skip if no matches found
    [ -e "$fallback" ] || continue
    
    # Get file modification time in seconds
    file_time=$(stat -c %Y "$fallback")
    elapsed=$((now - file_time))
    
    if [ $elapsed -lt $recent_threshold ]; then
      count=$((count+1))
      log "Attempting to reprocess: $(basename "$fallback")"
      
      # Extract original filename and try to find it in uploads
      original_name=$(basename "$fallback" | sed -E 's/_[0-9]+_fallback_[0-9]+\.pdf$//')
      original_file=""
      
      for upload in "$UPLOADS_DIR"/${original_name}*.pdf; do
        if [ -e "$upload" ]; then
          original_file="$upload"
          break
        fi
      done
      
      if [ -n "$original_file" ]; then
        log "Found original file: $original_file"
        
        # Run the reprocessing script
        if /home/rayyan9477/ocr-app/reprocess-medical-bill.sh "$original_file"; then
          log "Successfully reprocessed: $original_file"
          success_count=$((success_count+1))
        else
          log "Failed to reprocess: $original_file"
        fi
      else
        log "Could not find original file for: $(basename "$fallback")"
      fi
    fi
  done
  
  log "Attempted to reprocess $count recent failures, $success_count successful"
  
  if [ $count -gt 0 ]; then
    send_alert "OCR Reprocessing Report" "Attempted to reprocess $count recent failures, $success_count were successful."
  fi
}

# Main execution
log "========================="
log "OCR Monitor starting"
log "========================="

run_monitoring

# Attempt reprocessing if there are fallback files
if [ -n "$(find "$PROCESSED_DIR" -name "*_fallback_*.pdf" -print -quit)" ]; then
  reprocess_recent_failures
fi

log "OCR Monitor finished"
log "========================="

echo "Monitoring completed. See log at: $MONITOR_LOG"
