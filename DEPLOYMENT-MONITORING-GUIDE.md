# OCR Medical Bill Processing - Deployment & Monitoring Guide

This document provides instructions for deploying and monitoring the OCR medical bill processing fixes.

## Deployment Steps

### 1. Prepare for Deployment

Before deployment, ensure all dependencies are installed:

```bash
# Check OCRmyPDF installation
ocrmypdf --version

# Ensure other dependencies are present
tesseract --version
pdftoppm -v
imagemagick -version
```

### 2. Backup Current System

Always create a backup before deployment:

```bash
# Create backup directory
mkdir -p ~/ocr-app-backup-$(date +%Y%m%d)

# Backup critical files
cp -r /home/rayyan9477/ocr-app/lib ~/ocr-app-backup-$(date +%Y%m%d)/
cp -r /home/rayyan9477/ocr-app/app/api/ocr ~/ocr-app-backup-$(date +%Y%m%d)/
cp -r /home/rayyan9477/ocr-app/config ~/ocr-app-backup-$(date +%Y%m%d)/
```

### 3. Deploy Using Automation Script

The easiest way to deploy is using the provided automation script:

```bash
# Make script executable
chmod +x /home/rayyan9477/ocr-app/deploy-ocr-fixes.sh

# Run deployment script
./deploy-ocr-fixes.sh
```

The deployment script will:
- Backup existing files
- Check for dependencies
- Deploy updated scripts
- Set proper permissions
- Run verification tests
- Set up monitoring
- Restart services if needed

### 4. Manual Deployment Steps

If you prefer manual deployment, follow these steps:

1. **Set proper permissions**
   ```bash
   chmod +x /home/rayyan9477/ocr-app/fix-ocr-medical.sh
   chmod +x /home/rayyan9477/ocr-app/reprocess-medical-bill.sh
   chmod +x /home/rayyan9477/ocr-app/monitor-ocr-processing.sh
   chmod -R 777 /home/rayyan9477/ocr-app/uploads
   chmod -R 777 /home/rayyan9477/ocr-app/processed
   ```

2. **Set up monitoring cron job**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line to run monitoring hourly
   0 * * * * /home/rayyan9477/ocr-app/monitor-ocr-processing.sh >> /home/rayyan9477/ocr-app/logs/monitor.log 2>&1
   ```

3. **Verify the deployment**
   ```bash
   # Run test script
   ./test-ocr-system.sh
   
   # Test medical bill processing
   ./fix-ocr-medical.sh
   ```

4. **Restart the application server**
   ```bash
   # If using systemd
   sudo systemctl restart ocr-app.service
   
   # If using Docker
   docker restart <container-name>
   ```

## Monitoring The System

### 1. Automated Monitoring

The monitoring script `/home/rayyan9477/ocr-app/monitor-ocr-processing.sh` checks for:

- Pending files (uploaded but not processed)
- Stalled processing (files stuck in processing)
- Fallback files (OCR failures)
- Disk space usage

By default, it runs hourly via cron and logs to `/home/rayyan9477/ocr-app/logs/monitor.log`.

### 2. Email Alerts

To enable email alerts:

```bash
# Run with email alerts enabled
EMAIL_ALERTS=true EMAIL_RECIPIENT=your-email@example.com ./monitor-ocr-processing.sh
```

To configure permanent email alerts, edit the script and set these variables at the top:
```bash
EMAIL_ALERTS="true"
EMAIL_RECIPIENT="your-email@example.com" 
```

### 3. Manual Monitoring

You can check for processing issues manually:

```bash
# Check for fallback files (OCR failures)
find /home/rayyan9477/ocr-app/processed -name "*_fallback_*.pdf" -type f

# Check application logs
tail -n 100 /home/rayyan9477/ocr-app/logs/app.log

# Check monitor logs
tail -n 100 /home/rayyan9477/ocr-app/logs/monitor.log
```

### 4. Reprocessing Failed Files

To reprocess files that failed OCR:

```bash
# Reprocess a specific file
./reprocess-medical-bill.sh /path/to/file.pdf

# Reprocess all recent failures (via monitor script)
./monitor-ocr-processing.sh
```

## Troubleshooting Common Issues

### 1. Permission Issues

If you encounter permission errors:

```bash
# Fix permissions
./ensure-permissions.sh

# Check log files for errors
ls -la /home/rayyan9477/ocr-app/logs/
```

### 2. OCR Failed with 500 Error

If OCR processing fails with a 500 error:

1. Check if the file has special characteristics:
   ```bash
   pdfinfo /path/to/file.pdf
   ```

2. Try manual reprocessing:
   ```bash
   ./reprocess-medical-bill.sh /path/to/file.pdf
   ```

3. Check logs for specific error messages:
   ```bash
   grep "error" /home/rayyan9477/ocr-app/logs/app.log | tail -n 20
   ```

### 3. Monitoring Shows High Failure Rate

If monitoring shows a high failure rate:

1. Check for common patterns in failing files
2. Verify Tesseract and OCRmyPDF versions
3. Review system resources (CPU, memory, disk space)
4. Look for specific error messages in the logs

### 4. System Appears Sluggish

If the system is processing slowly:

1. Check system resources:
   ```bash
   df -h  # Check disk space
   free -m  # Check memory
   top  # Check CPU usage
   ```

2. Look for too many concurrent processes:
   ```bash
   ps aux | grep ocrmypdf | wc -l  # Count OCR processes
   ```

3. Consider adding rate limiting or queue management

## Further Optimization Recommendations

1. **Implement a Processing Queue**:
   Consider adding a message queue (RabbitMQ, Redis) to manage processing load

2. **Fine-tune Tesseract Configuration**:
   Experiment with different settings in `medical_config.cfg` 

3. **Preprocess Specific File Types**:
   Add specialized handling for common medical form types

4. **Add Resource Monitoring**:
   Track resource usage over time to identify bottlenecks

5. **Implement Automated Testing**:
   Create a test suite with representative medical documents

## Conclusion

By following these deployment and monitoring steps, you'll have a robust OCR system for medical bill processing with proper error handling, monitoring, and recovery mechanisms.
