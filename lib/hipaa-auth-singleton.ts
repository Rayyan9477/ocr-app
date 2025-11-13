/**
 * Authentication service stub
 * Simple in-memory authentication for development
 */

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface Session {
  userId: string;
  email: string;
  role: string;
  createdAt: Date;
}

class HipaaAuthService {
  private sessions: Map<string, Session> = new Map();
  private users: Map<string, User> = new Map();

  async createUser(email: string, password: string, role: string = 'user'): Promise<User> {
    const id = Math.random().toString(36).substring(7);
    const user: User = { id, email, role };
    this.users.set(email, user);
    return user;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    return this.users.get(email) || null;
  }

  async createSession(userId: string): Promise<string> {
    const sessionId = Math.random().toString(36).substring(7);
    const user = Array.from(this.users.values()).find(u => u.id === userId);

    if (user) {
      this.sessions.set(sessionId, {
        userId,
        email: user.email,
        role: user.role,
        createdAt: new Date()
      });
    }

    return sessionId;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async logAuditEvent(event: any): Promise<void> {
    // Stub - in production this would log to a database
    console.log('Audit event:', event);
  }
}

// Export singleton instance
const hipaaAuth = new HipaaAuthService();
export default hipaaAuth;

// Named exports for compatibility
export const authService = hipaaAuth;
export const auditLogger = {
  log: async (event: any) => {
    await hipaaAuth.logAuditEvent(event);
  }
};
