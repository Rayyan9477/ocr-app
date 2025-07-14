#!/bin/bash

# Comprehensive codebase cleanup script
# This script removes unnecessary files to reduce deployment size

set -e

echo "🧹 Starting comprehensive codebase cleanup..."

# Function to log cleanup actions
log_cleanup() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a cleanup.log
}

# Create cleanup log
touch cleanup.log
log_cleanup "Starting cleanup process"

# 1. Remove backup files
log_cleanup "Removing backup files..."
find . -name "*.backup" -type f -delete 2>/dev/null || true
find . -name "*.bak" -type f -delete 2>/dev/null || true
find . -name "*.tmp" -type f -delete 2>/dev/null || true
log_cleanup "Backup files removed"

# 2. Clean processed directory (keep only essential files)
log_cleanup "Cleaning processed directory..."
if [ -d "processed" ]; then
    # Remove duplicate processed files (files with timestamps)
    find processed/ -name "*_[0-9]*_smart_ocr.pdf" -type f -delete 2>/dev/null || true
    find processed/ -name "*_[0-9]*_forced_ocr.pdf" -type f -delete 2>/dev/null || true
    find processed/ -name "*_[0-9]*_ocr.pdf" -type f -delete 2>/dev/null || true
    find processed/ -name "*_confidence.json" -type f -delete 2>/dev/null || true
    
    # Remove test files
    find processed/ -name "test*" -type f -delete 2>/dev/null || true
    find processed/ -name "input_*" -type f -delete 2>/dev/null || true
    find processed/ -name "multipage-test*" -type f -delete 2>/dev/null || true
    
    # Remove large duplicate files
    rm -f processed/superbill2_*_smart_ocr.pdf 2>/dev/null || true
    rm -f processed/Nobility\ Batch\ 3\ Notes\ by\ Ali\ Zeb_*_smart_ocr.pdf 2>/dev/null || true
    
    # Remove empty zip files
    find processed/ -name "*.zip" -size 0 -delete 2>/dev/null || true
    
    log_cleanup "Processed directory cleaned"
fi

# 3. Clean logs directory
log_cleanup "Cleaning logs directory..."
if [ -d "logs" ]; then
    # Keep only recent logs (last 7 days) and limit size
    find logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # Truncate large log files
    for logfile in logs/*.log; do
        if [ -f "$logfile" ] && [ $(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0) -gt 10485760 ]; then
            tail -n 1000 "$logfile" > "${logfile}.tmp" && mv "${logfile}.tmp" "$logfile"
            log_cleanup "Truncated large log file: $logfile"
        fi
    done
fi

# 4. Clean tmp directory
log_cleanup "Cleaning tmp directory..."
if [ -d "tmp" ]; then
    # Remove old temporary files (older than 1 day)
    find tmp/ -type f -mtime +1 -delete 2>/dev/null || true
    find tmp/ -type d -empty -delete 2>/dev/null || true
    log_cleanup "Tmp directory cleaned"
fi

# 5. Clean uploads directory (keep only essential test files)
log_cleanup "Cleaning uploads directory..."
if [ -d "uploads" ]; then
    # Remove large test files, keep small ones for testing
    find uploads/ -name "enhanced_*" -type f -delete 2>/dev/null || true
    log_cleanup "Uploads directory cleaned"
fi

# 6. Clean audit logs (keep only recent ones)
log_cleanup "Cleaning audit logs..."
if [ -d "audit_logs" ]; then
    # Keep only logs from last 30 days
    find audit_logs/ -name "*.log" -mtime +30 -delete 2>/dev/null || true
    log_cleanup "Audit logs cleaned"
fi

# 7. Remove development and testing artifacts
log_cleanup "Removing development artifacts..."

# Remove Jest cache
rm -rf .jest_cache 2>/dev/null || true

# Remove Next.js cache (will be rebuilt)
rm -rf .next/cache 2>/dev/null || true

# Remove TypeScript build info
rm -f tsconfig.tsbuildinfo 2>/dev/null || true

# Remove any leftover test files
find . -name "*.test.js" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "*.spec.js" -not -path "./node_modules/*" -delete 2>/dev/null || true

# 8. Clean output directory
if [ -d "output" ]; then
    find output/ -type f -mtime +7 -delete 2>/dev/null || true
    find output/ -type d -empty -delete 2>/dev/null || true
    log_cleanup "Output directory cleaned"
fi

# 9. Remove secure_storage test files
if [ -d "secure_storage" ]; then
    find secure_storage/ -name "test_*" -delete 2>/dev/null || true
    log_cleanup "Secure storage test files removed"
fi

# 10. Clean infrastructure directory of non-essential files
if [ -d "infrastructure" ]; then
    find infrastructure/ -name "*.backup" -delete 2>/dev/null || true
    find infrastructure/ -name "*.tmp" -delete 2>/dev/null || true
    log_cleanup "Infrastructure directory cleaned"
fi

# Calculate space saved
log_cleanup "Cleanup completed successfully"

echo ""
echo "🎉 Cleanup completed! Check cleanup.log for details."
echo ""
echo "📊 Current directory sizes after cleanup:"
du -sh */ 2>/dev/null | sort -hr | head -10

echo ""
echo "🔍 Remaining large files (>10MB):"
find . -type f -size +10M -not -path "./node_modules/*" -exec ls -lh {} \; 2>/dev/null | head -10

echo ""
echo "✅ Cleanup summary logged to cleanup.log"
