import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  outcome: 'SUCCESS' | 'FAILURE';
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}

interface HIPAARequiredEvents {
  USER_LOGIN: 'User authentication';
  USER_LOGOUT: 'User session termination';
  FILE_UPLOAD: 'PHI data input';
  FILE_ACCESS: 'PHI data access';
  FILE_DOWNLOAD: 'PHI data export';
  FILE_DELETE: 'PHI data deletion';
  OCR_PROCESS: 'PHI data processing';
  CONFIG_CHANGE: 'System configuration change';
  ACCESS_DENIED: 'Unauthorized access attempt';
  DATA_BREACH: 'Potential security incident';
}

class HIPAAAuditLogger {
  private readonly logDir: string;
  private readonly encryptLogs: boolean;
  private readonly retentionYears: number;

  constructor(
    logDir: string = './audit_logs',
    encryptLogs: boolean = true,
    retentionYears: number = 6
  ) {
    this.logDir = logDir;
    this.encryptLogs = encryptLogs;
    this.retentionYears = retentionYears;
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  private generateEventId(): string {
    return crypto.randomUUID();
  }

  private getLogFileName(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return `audit_${dateStr}.log`;
  }

  async logEvent(
    userId: string,
    userRole: string,
    action: keyof HIPAARequiredEvents,
    resource: string,
    outcome: 'SUCCESS' | 'FAILURE',
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void>;
  async logEvent(event: {
    userId: string;
    userRole: string;
    action: keyof HIPAARequiredEvents;
    resource: string;
    outcome: 'SUCCESS' | 'FAILURE';
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<void>;
  async logEvent(
    userIdOrEvent: string | {
      userId: string;
      userRole: string;
      action: keyof HIPAARequiredEvents;
      resource: string;
      outcome: 'SUCCESS' | 'FAILURE';
      details?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    },
    userRole?: string,
    action?: keyof HIPAARequiredEvents,
    resource?: string,
    outcome?: 'SUCCESS' | 'FAILURE',
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      let event: AuditEvent;
      
      if (typeof userIdOrEvent === 'object') {
        // Called with object parameter
        const eventParam = userIdOrEvent;
        event = {
          id: this.generateEventId(),
          timestamp: new Date(),
          userId: eventParam.userId,
          userRole: eventParam.userRole,
          action: eventParam.action,
          resource: eventParam.resource,
          outcome: eventParam.outcome,
          details: {
            ...(eventParam.details || {}),
            dataClassification: this.classifyData(eventParam.resource),
            complianceLevel: 'HIPAA',
          },
          ipAddress: eventParam.ipAddress || 'unknown',
          userAgent: eventParam.userAgent || 'unknown',
          sessionId: eventParam.sessionId || 'unknown',
        };
      } else {
        // Called with individual parameters
        event = {
          id: this.generateEventId(),
          timestamp: new Date(),
          userId: userIdOrEvent,
          userRole: userRole!,
          action: action!,
          resource: resource!,
          outcome: outcome!,
          details: {
            ...details,
            dataClassification: this.classifyData(resource!),
            complianceLevel: 'HIPAA',
          },
          ipAddress: request?.ip || 'unknown',
          userAgent: request?.userAgent || 'unknown',
          sessionId: request?.sessionId || 'unknown',
        };
      }

      await this.writeAuditEvent(event);
      
      // Check for security incidents
      await this.checkSecurityIncident(event);
      
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Critical: audit logging failure should be handled
      await this.logCriticalError(error);
    }
  }

  private async writeAuditEvent(event: AuditEvent): Promise<void> {
    const logLine = JSON.stringify(event) + '\n';
    const fileName = this.getLogFileName(event.timestamp);
    const filePath = path.join(this.logDir, fileName);
    
    if (this.encryptLogs) {
      // In production, encrypt audit logs
      await this.writeEncryptedLog(filePath, logLine);
    } else {
      await fs.appendFile(filePath, logLine);
    }
  }

  private async writeEncryptedLog(filePath: string, data: string): Promise<void> {
    // For demo purposes - in production, use proper key management
    const key = crypto.scryptSync('audit-log-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const logEntry = `${iv.toString('hex')}:${encrypted}\n`;
    await fs.appendFile(filePath, logEntry);
  }

  private classifyData(resource: string): string {
    if (resource.includes('medical') || resource.includes('patient')) {
      return 'PHI';
    }
    if (resource.includes('user') || resource.includes('auth')) {
      return 'PII';
    }
    return 'GENERAL';
  }

  private async checkSecurityIncident(event: AuditEvent): Promise<void> {
    // Check for suspicious patterns
    const suspiciousActions = ['ACCESS_DENIED', 'DATA_BREACH'];
    const criticalFailures = event.outcome === 'FAILURE' && suspiciousActions.includes(event.action);
    
    if (criticalFailures) {
      await this.triggerSecurityAlert(event);
    }
    
    // Check for multiple failed attempts
    await this.checkFailedAttempts(event);
  }

  private async triggerSecurityAlert(event: AuditEvent): Promise<void> {
    const alert = {
      alertId: crypto.randomUUID(),
      timestamp: new Date(),
      severity: 'HIGH',
      description: `Security incident detected: ${event.action}`,
      userId: event.userId,
      ipAddress: event.ipAddress,
      action: 'SECURITY_ALERT_GENERATED',
    };
    
    // Log the security alert
    await this.logEvent(
      'SYSTEM',
      'SYSTEM',
      'DATA_BREACH',
      'SECURITY_ALERT',
      'SUCCESS',
      alert
    );
    
    // In production: send to security team, SIEM, etc.
    console.warn('🚨 SECURITY ALERT:', alert);
  }

  private async checkFailedAttempts(event: AuditEvent): Promise<void> {
    if (event.outcome === 'FAILURE' && event.action === 'USER_LOGIN') {
      // In production: check recent failed attempts from same IP/user
      // Implement rate limiting and account lockout
    }
  }

  private async logCriticalError(error: any): Promise<void> {
    try {
      const criticalLog = {
        timestamp: new Date().toISOString(),
        level: 'CRITICAL',
        message: 'Audit logging system failure',
        error: error.message,
        stack: error.stack,
      };
      
      // Write to separate critical error log
      const criticalLogPath = path.join(this.logDir, 'critical_errors.log');
      await fs.appendFile(criticalLogPath, JSON.stringify(criticalLog) + '\n');
    } catch (criticalError) {
      // Last resort: console logging
      console.error('CRITICAL: Audit system completely failed:', criticalError);
    }
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      const report = {
        reportId: crypto.randomUUID(),
        generatedAt: new Date(),
        period: { startDate, endDate },
        summary: {
          totalEvents: 0,
          userLogins: 0,
          fileAccesses: 0,
          securityIncidents: 0,
          failedAttempts: 0,
        },
        details: {
          userActivity: new Map(),
          fileActivity: new Map(),
          securityEvents: [],
        },
      };

      // Parse log files for the date range
      const logFiles = await this.getLogFilesInRange(startDate, endDate);
      
      for (const logFile of logFiles) {
        const events = await this.parseLogFile(logFile);
        for (const event of events) {
          this.updateReportWithEvent(report, event);
        }
      }

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new Error('Compliance report generation failed');
    }
  }

  private async getLogFilesInRange(startDate: Date, endDate: Date): Promise<string[]> {
    const files = await fs.readdir(this.logDir);
    return files.filter(file => {
      if (!file.startsWith('audit_') || !file.endsWith('.log')) return false;
      
      const dateStr = file.substring(6, 16); // Extract date from filename
      const fileDate = new Date(dateStr);
      return fileDate >= startDate && fileDate <= endDate;
    });
  }

  private async parseLogFile(fileName: string): Promise<AuditEvent[]> {
    const filePath = path.join(this.logDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
      try {
        return JSON.parse(line) as AuditEvent;
      } catch {
        return null;
      }
    }).filter(Boolean) as AuditEvent[];
  }

  private updateReportWithEvent(report: any, event: AuditEvent): void {
    report.summary.totalEvents++;
    
    switch (event.action) {
      case 'USER_LOGIN':
        report.summary.userLogins++;
        break;
      case 'FILE_ACCESS':
        report.summary.fileAccesses++;
        break;
      case 'ACCESS_DENIED':
      case 'DATA_BREACH':
        report.summary.securityIncidents++;
        report.details.securityEvents.push(event);
        break;
    }
    
    if (event.outcome === 'FAILURE') {
      report.summary.failedAttempts++;
    }
  }

  async getAuditLogs(
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      action?: string;
      outcome?: 'SUCCESS' | 'FAILURE';
    } = {},
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditEvent[]> {
    try {
      const logs: AuditEvent[] = [];
      const logFiles = await fs.readdir(this.logDir);
      
      // Filter log files by date if specified
      const relevantFiles = logFiles.filter(file => {
        if (!file.startsWith('audit_') || !file.endsWith('.log')) return false;
        if (filters.startDate || filters.endDate) {
          const dateMatch = file.match(/audit_(\d{4}-\d{2}-\d{2})\.log/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (filters.startDate && fileDate < filters.startDate) return false;
            if (filters.endDate && fileDate > filters.endDate) return false;
          }
        }
        return true;
      });

      // Read and parse log files
      for (const file of relevantFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const event: AuditEvent = JSON.parse(line);
            
            // Apply filters
            if (filters.userId && event.userId !== filters.userId) continue;
            if (filters.action && event.action !== filters.action) continue;
            if (filters.outcome && event.outcome !== filters.outcome) continue;
            
            logs.push(event);
          } catch (parseError) {
            console.error('Failed to parse audit log line:', parseError);
          }
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Apply pagination
      return logs.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  async getAuditStats(filters: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    action?: string;
    outcome?: 'SUCCESS' | 'FAILURE';
  } = {}): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    uniqueUsers: number;
    recentActivity: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    try {
      const logs = await this.getAuditLogs(filters, 10000); // Get more logs for stats
      
      const stats = {
        totalEvents: logs.length,
        successfulEvents: logs.filter(log => log.outcome === 'SUCCESS').length,
        failedEvents: logs.filter(log => log.outcome === 'FAILURE').length,
        uniqueUsers: new Set(logs.map(log => log.userId)).size,
        recentActivity: logs.filter(log => 
          new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        topActions: [] as Array<{ action: string; count: number }>
      };

      // Calculate top actions
      const actionCounts = new Map<string, number>();
      logs.forEach(log => {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
      });

      stats.topActions = Array.from(actionCounts.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return stats;
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        uniqueUsers: 0,
        recentActivity: 0,
        topActions: []
      };
    }
  }

  async exportAuditLogs(
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      action?: string;
      outcome?: 'SUCCESS' | 'FAILURE';
    } = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs(filters, 10000); // Export more logs
      
      if (format === 'csv') {
        const headers = ['Timestamp', 'User ID', 'User Role', 'Action', 'Resource', 'Outcome', 'IP Address', 'User Agent', 'Session ID'];
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
          const row = [
            log.timestamp,
            log.userId,
            log.userRole,
            log.action,
            log.resource,
            log.outcome,
            log.ipAddress,
            log.userAgent,
            log.sessionId
          ].map(field => `"${field}"`);
          csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
      } else {
        return JSON.stringify(logs, null, 2);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw new Error('Export failed');
    }
  }

  private formatLogEntry(event: AuditEvent): string {
    return JSON.stringify(event) + '\n';
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test if we can write to audit log directory
      await this.ensureLogDirectory();
      
      // Test if we can create a health check log entry
      const testEvent: AuditEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        userId: 'SYSTEM',
        userRole: 'system',
        action: 'HEALTH_CHECK',
        resource: 'audit-system',
        outcome: 'SUCCESS',
        details: { test: true },
        ipAddress: 'SYSTEM',
        userAgent: 'HEALTH_CHECK',
        sessionId: 'HEALTH_CHECK'
      };
      
      const logEntry = this.formatLogEntry(testEvent);
      const testLogPath = path.join(this.logDir, 'health_check.log');
      
      // Try to write and then clean up
      await fs.writeFile(testLogPath, logEntry);
      await fs.unlink(testLogPath);
      
      return true;
    } catch (error) {
      console.error('Audit logger health check failed:', error);
      return false;
    }
  }
}

export { HIPAAAuditLogger, type AuditEvent, type HIPAARequiredEvents };
