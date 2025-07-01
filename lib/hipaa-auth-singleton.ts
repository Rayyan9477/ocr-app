import { HIPAAAuthService } from './hipaa-auth';
import { HIPAAAuditLogger } from './hipaa-audit';

const getJWTSecret = () => {
  return process.env.JWT_SECRET || process.env.HIPAA_SIGNING_KEY || 'default-jwt-secret-change-in-production';
};

const getAdminOnlyMode = () => {
  return process.env.ADMIN_ONLY_MODE === 'true';
};

// Use global to persist instances across hot reloads in development
declare global {
  var __authService: HIPAAAuthService | undefined;
  var __auditLogger: HIPAAAuditLogger | undefined;
}

// Create singleton instances with global persistence
if (!globalThis.__authService) {
  globalThis.__authService = new HIPAAAuthService(
    getJWTSecret(),
    15, // session timeout in minutes
    3,  // max failed attempts
    30, // lockout duration in minutes
    getAdminOnlyMode()
  );
}

if (!globalThis.__auditLogger) {
  globalThis.__auditLogger = new HIPAAAuditLogger();
}

export const authService = globalThis.__authService;
export const auditLogger = globalThis.__auditLogger;

// Export a function to get fresh instances if needed
export const getAuthService = () => authService;
export const getAuditLogger = () => auditLogger;
