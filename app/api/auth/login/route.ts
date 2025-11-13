import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

export async function POST(request: NextRequest) {
  try {
    const { email, password, mfaCode } = await request.json();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Validate input
    if (!email || !password) {
      await auditLogger.logEvent({
        userId: 'anonymous',
        userRole: 'unknown',
        action: 'USER_LOGIN',
        resource: 'auth',
        outcome: 'FAILURE',
        details: { reason: 'Missing credentials', email },
        ipAddress,
        userAgent,
        sessionId: 'none'
      });

      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Attempt authentication
    try {
      const authResult = await authService.authenticateUser(
        email, 
        password, 
        ipAddress, 
        userAgent
      );
      
      if (authResult) {
        // Log successful login
        await auditLogger.logEvent({
          userId: authResult.user.id,
          userRole: authResult.user.role,
          action: 'USER_LOGIN',
          resource: 'auth',
          outcome: 'SUCCESS',
          details: { email, mfaUsed: !!mfaCode },
          ipAddress,
          userAgent,
          sessionId: authResult.session.id
        });

        // Set HTTP-only cookie with session token
        const response = NextResponse.json({
          success: true,
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            role: authResult.user.role === 'admin' ? 'user' : authResult.user.role // Hide admin role from client
          }
        });

        response.cookies.set('hipaa-session', authResult.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 60 // 30 minutes
        });

        return response;
      } else {
        // Authentication failed
        await auditLogger.logEvent({
          userId: 'unknown',
          userRole: 'unknown',
          action: 'USER_LOGIN',
          resource: 'auth',
          outcome: 'FAILURE',
          details: { 
            reason: 'Invalid credentials',
            email
          },
          ipAddress,
          userAgent,
          sessionId: 'none'
        });

        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    } catch (authError) {
      // Handle auth errors (locked account, etc.)
      await auditLogger.logEvent({
        userId: 'unknown',
        userRole: 'unknown',
        action: 'USER_LOGIN',
        resource: 'auth',
        outcome: 'FAILURE',
        details: { 
          reason: authError instanceof Error ? authError.message : 'Authentication error',
          email
        },
        ipAddress,
        userAgent,
        sessionId: 'none'
      });

      return NextResponse.json(
        { 
          error: authError instanceof Error ? authError.message : 'Authentication failed'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Log system error
    await auditLogger.logEvent({
      userId: 'system',
      userRole: 'system',
      action: 'USER_LOGIN',
      resource: 'auth',
      outcome: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: 'none'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
