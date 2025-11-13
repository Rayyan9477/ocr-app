/**
 * Authentication service stub
 * Simple in-memory authentication for development
 */

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  password?: string;
  mfaEnabled?: boolean;
}

interface Session {
  id?: string;
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
    const user: User = { id, email, role, password };
    this.users.set(email, user);
    return user;
  }

  async registerUser(email: string, password: string, role: string = 'user'): Promise<User> {
    return this.createUser(email, password, role);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = this.users.get(email);
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async authenticateUser(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; session: { id: string }; token: string } | null> {
    const user = await this.validateUser(email, password);
    if (!user) {
      return null;
    }

    // Create session
    const sessionId = await this.createSession(user.id);

    return {
      user,
      session: { id: sessionId },
      token: sessionId
    };
  }

  async authenticate(credentials: { email: string; password: string }): Promise<{ success: boolean; user: User } | null>;
  async authenticate(email: string, password: string): Promise<{ success: boolean; user: User } | null>;
  async authenticate(
    emailOrCredentials: string | { email: string; password: string },
    password?: string
  ): Promise<{ success: boolean; user: User } | null> {
    const email = typeof emailOrCredentials === 'string' ? emailOrCredentials : emailOrCredentials.email;
    const pass = typeof emailOrCredentials === 'string' ? password! : emailOrCredentials.password;

    const user = await this.validateUser(email, pass);
    if (!user) {
      return null;
    }

    return { success: true, user };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.get(email) || null;
  }

  async getUserById(userId: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.id === userId) || null;
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

  async validateSession(sessionId: string): Promise<Session | null> {
    return this.getSession(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.destroySession(sessionId);
  }

  async logAuditEvent(event: Record<string, unknown>): Promise<void> {
    // Stub - in production this would log to a database
    console.log('Audit event:', event);
  }

  async logEvent(event: Record<string, unknown>): Promise<void> {
    return this.logAuditEvent(event);
  }
}

// Export singleton instance
const hipaaAuth = new HipaaAuthService();
export default hipaaAuth;

// Named exports for compatibility
export const authService = hipaaAuth;
export const auditLogger = {
  log: async (event: Record<string, unknown>) => {
    await hipaaAuth.logAuditEvent(event);
  },
  logEvent: async (event: Record<string, unknown>) => {
    await hipaaAuth.logAuditEvent(event);
  }
};
