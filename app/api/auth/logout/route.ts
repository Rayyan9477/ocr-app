import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      );
    }

    // Validate session and get user info
    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Log logout event
    await auditLogger.logEvent({
      userId: session.userId,
      userRole: 'user', // We'd need to fetch user details for exact role
      action: 'USER_LOGOUT',
      resource: 'auth',
      outcome: 'SUCCESS',
      details: { sessionId: 'session-id-placeholder' },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: 'session-id-placeholder'
    });

    // Revoke session
    await authService.revokeSession(sessionToken);

    // Clear cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('hipaa-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
