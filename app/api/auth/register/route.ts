import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

export async function POST(request: NextRequest) {
  try {
    const { email, password, role = 'user' } = await request.json();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if we're in admin-only mode
    const adminOnlyMode = process.env.ADMIN_ONLY_MODE === 'true';
    
    if (adminOnlyMode) {
      // Block all registrations in admin-only mode
      await auditLogger.logEvent({
        userId: 'anonymous',
        userRole: 'unknown',
        action: 'USER_REGISTRATION_BLOCKED',
        resource: 'auth',
        outcome: 'FAILURE',
        details: { 
          reason: 'Registration disabled - system in admin-only mode',
          email: email || 'unknown',
          attemptedRole: role 
        },
        ipAddress,
        userAgent,
        sessionId: 'none'
      });

      return NextResponse.json(
        { 
          error: 'Registration is disabled. This system is in admin-only mode.',
          message: 'Please contact the system administrator for access.'
        },
        { status: 403 }
      );
    }

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await authService.getUserByEmail(email);
    if (existingUser) {
      await auditLogger.logEvent({
        userId: 'anonymous',
        userRole: 'unknown',
        action: 'USER_REGISTRATION_DUPLICATE',
        resource: 'auth',
        outcome: 'FAILURE',
        details: { reason: 'Email already exists', email },
        ipAddress,
        userAgent,
        sessionId: 'none'
      });

      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Register the user
    const user = await authService.registerUser(email, password, role as 'admin' | 'user' | 'viewer');

    // Log successful registration
    await auditLogger.logEvent({
      userId: user.id,
      userRole: user.role,
      action: 'USER_REGISTRATION',
      resource: 'auth',
      outcome: 'SUCCESS',
      details: { email: user.email, role: user.role },
      ipAddress,
      userAgent,
      sessionId: 'none'
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: 'user' // Always show as user role for security
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
