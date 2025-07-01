import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminConfig, isAdminCredentials, isAdminEmail } from './admin-config';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: Date;
  failedAttempts: number;
  lockedUntil?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt?: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

interface AccessControlRule {
  resource: string;
  action: string;
  roles: string[];
  conditions?: Record<string, any>;
}

class HIPAAAuthService {
  private readonly jwtSecret: string;
  private readonly sessionTimeout: number; // minutes
  private readonly maxFailedAttempts: number;
  private readonly lockoutDuration: number; // minutes
  private readonly adminOnlyMode: boolean; // New configuration option
  
  // In production, store in database
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  
  private accessRules: AccessControlRule[] = [
    { resource: 'file', action: 'upload', roles: ['admin', 'user'] },
    { resource: 'file', action: 'view', roles: ['admin', 'user', 'viewer'] },
    { resource: 'file', action: 'download', roles: ['admin', 'user'] },
    { resource: 'file', action: 'delete', roles: ['admin'] },
    { resource: 'ocr', action: 'process', roles: ['admin', 'user'] },
    { resource: 'admin', action: 'access', roles: ['admin'] },
  ];

  constructor(
    jwtSecret: string = process.env.JWT_SECRET || 'fallback-secret',
    sessionTimeout: number = 15, // HIPAA recommends 15 minutes
    maxFailedAttempts: number = 3,
    lockoutDuration: number = 30,
    adminOnlyMode: boolean = false // Default to false
  ) {
    this.jwtSecret = jwtSecret;
    this.sessionTimeout = sessionTimeout;
    this.maxFailedAttempts = maxFailedAttempts;
    this.lockoutDuration = lockoutDuration;
    this.adminOnlyMode = adminOnlyMode;
    
    // Initialize with predefined admin user
    this.initializeAdminUser();
  }

  private async initializeAdminUser(): Promise<void> {
    try {
      const adminConfig = getAdminConfig();
      
      if (!adminConfig.isConfigured) {
        console.error('Admin credentials not configured in environment variables');
        return;
      }
      
      // Check if admin already exists
      const existingAdmin = Array.from(this.users.values()).find(u => u.email === adminConfig.email);
      if (!existingAdmin) {
        const adminId = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(adminConfig.password!, 12);
        
        const adminUser: User = {
          id: adminId,
          email: adminConfig.email!,
          passwordHash,
          role: 'admin',
          isActive: true,
          failedAttempts: 0,
          mfaEnabled: false,
          createdAt: new Date(),
        };
        
        this.users.set(adminId, adminUser);
        console.log('✅ Admin user initialized:', adminConfig.email);
      }
    } catch (error) {
      console.error('Failed to initialize admin user:', error);
    }
  }

  async registerUser(
    email: string,
    password: string,
    role: 'admin' | 'user' | 'viewer' = 'user'
  ): Promise<User> {
    // Security: Force all registrations to be 'user' role only
    // Admin accounts can only be created through environment configuration
    const secureRole = 'user';
    
    // Validate password strength
    this.validatePasswordStrength(password);
    
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    
    const user: User = {
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      role: secureRole,
      isActive: true,
      failedAttempts: 0,
      mfaEnabled: false,
      createdAt: new Date(),
    };
    
    this.users.set(userId, user);
    return user;
  }

  private validatePasswordStrength(password: string): void {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
  }

  async authenticateUser(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ user: User; token: string; session: Session } | null> {
    // Always ensure admin user exists for this single-admin system
    await this.initializeAdminUser();
    
    let user = Array.from(this.users.values()).find(u => u.email === email);
    
    // Special handling for the predefined admin
    // Fallback: Direct admin credential check if user not found in system
    if (isAdminCredentials(email, password) && !user) {
      // Create admin user on-the-fly if not found
      const adminId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 12);
      
      user = {
        id: adminId,
        email: email,
        passwordHash,
        role: 'admin',
        isActive: true,
        failedAttempts: 0,
        mfaEnabled: false,
        createdAt: new Date(),
      };
      
      this.users.set(adminId, user);
    }
    
    if (!user) {
      return null;
    }
    
    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new Error('Account is temporarily locked due to failed login attempts');
    }
    
    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }
    
    // Verify password - special case for admin with direct password check
    let isValidPassword = false;
    if (isAdminCredentials(email, password)) {
      isValidPassword = true;
    } else {
      isValidPassword = await bcrypt.compare(password, user.passwordHash);
    }
    
    if (!isValidPassword) {
      await this.handleFailedLogin(user);
      return null;
    }
    
    // Reset failed attempts on successful login
    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLogin = new Date();
    
    // Create session
    const session = await this.createSession(user, ipAddress, userAgent);
    const token = this.generateJWT(user, session);
    
    return { user, token, session };
  }

  private async handleFailedLogin(user: User): Promise<void> {
    user.failedAttempts++;
    
    if (user.failedAttempts >= this.maxFailedAttempts) {
      const lockoutTime = new Date();
      lockoutTime.setMinutes(lockoutTime.getMinutes() + this.lockoutDuration);
      user.lockedUntil = lockoutTime;
    }
  }

  private async createSession(
    user: User,
    ipAddress: string,
    userAgent: string
  ): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.sessionTimeout);
    
    const session: Session = {
      id: sessionId,
      userId: user.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt,
      ipAddress,
      userAgent,
      isActive: true,
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  private generateJWT(user: User, session: Session): string {
    const payload = {
      userId: user.id,
      sessionId: session.id,
      role: user.role,
      email: user.email,
    };
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: `${this.sessionTimeout}m`,
      issuer: 'ocr-app',
      audience: 'ocr-users',
    });
  }

  async validateToken(token: string): Promise<{ user: User; session: Session } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const session = this.sessions.get(decoded.sessionId);
      const user = this.users.get(decoded.userId);
      
      if (!session || !user || !session.isActive || new Date() > session.expiresAt) {
        return null;
      }
      
      // Extend session if still active
      session.expiresAt = new Date();
      session.expiresAt.setMinutes(session.expiresAt.getMinutes() + this.sessionTimeout);
      
      return { user, session };
    } catch (error) {
      return null;
    }
  }

  async logoutUser(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  async logoutAllSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.isActive = false;
      }
    }
  }

  hasPermission(userRole: string, resource: string, action: string): boolean {
    const rule = this.accessRules.find(r => r.resource === resource && r.action === action);
    return rule ? rule.roles.includes(userRole) : false;
  }

  // Middleware for protecting routes
  createAuthMiddleware() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const auth = await this.validateToken(token);
      
      if (!auth) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      
      // Add user info to request headers for downstream handlers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', auth.user.id);
      requestHeaders.set('x-user-role', auth.user.role);
      requestHeaders.set('x-session-id', auth.session.id);
      
      return null; // Continue processing
    };
  }

  // Role-based access control middleware
  createRoleMiddleware(resource: string, action: string) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const userRole = request.headers.get('x-user-role');
      
      if (!userRole || !this.hasPermission(userRole, resource, action)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      return null; // Continue processing
    };
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt || !session.isActive) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Generate compliance report for user activities
  async generateUserActivityReport(startDate: Date, endDate: Date): Promise<any> {
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.isActive && s.expiresAt >= startDate
    );
    
    const activeUsers = Array.from(this.users.values()).filter(
      u => u.isActive && u.lastLogin && u.lastLogin >= startDate
    );
    
    return {
      reportPeriod: { startDate, endDate },
      totalActiveUsers: activeUsers.length,
      totalActiveSessions: activeSessions.length,
      userDetails: activeUsers.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        lastLogin: u.lastLogin,
        mfaEnabled: u.mfaEnabled,
      })),
      sessionDetails: activeSessions.map(s => ({
        userId: s.userId,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        expiresAt: s.expiresAt,
      })),
    };
  }

  // Additional helper methods
  async getUserByEmail(email: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.email === email.toLowerCase());
    return user || null;
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async validateSession(token: string): Promise<Session | null> {
    const result = await this.validateToken(token);
    return result?.session || null;
  }

  async validateSessionWithUser(token: string): Promise<{ session: Session; user: User } | null> {
    const result = await this.validateToken(token);
    if (result?.session && result?.user) {
      return { session: result.session, user: result.user };
    }
    return null;
  }

  async revokeSession(token: string): Promise<void> {
    const result = await this.validateToken(token);
    if (result?.session) {
      await this.logoutUser(result.session.id);
    }
  }

  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user || !user.isActive) {
      return false;
    }

    const rule = this.accessRules.find(r => r.resource === resource && r.action === action);
    if (!rule) {
      return false;
    }

    return rule.roles.includes(user.role);
  }

  // User management methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map(user => ({
      ...user,
      passwordHash: undefined // Don't expose password hashes
    })) as User[];
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // Update allowed fields
    if (updates.isActive !== undefined) {
      user.isActive = updates.isActive;
    }
    if (updates.role !== undefined) {
      user.role = updates.role;
    }
    if (updates.mfaEnabled !== undefined) {
      user.mfaEnabled = updates.mfaEnabled;
    }

    this.users.set(userId, user);
    return { ...user, passwordHash: undefined } as User;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // Don't allow deleting admin user
    if (user.role === 'admin' && isAdminEmail(user.email)) {
      return false;
    }

    this.users.delete(userId);
    
    // Also revoke all sessions for this user
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
    
    return true;
  }
}

export { HIPAAAuthService, type User, type Session, type AccessControlRule };
