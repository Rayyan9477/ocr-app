import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

// Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('hipaa-session')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionData = await authService.validateSessionWithUser(token);
    if (!sessionData || sessionData.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all users from the auth service
    const users = await authService.getAllUsers();

    await auditLogger.logEvent({
      userId: sessionData.user.id,
      userRole: sessionData.user.role,
      action: 'USER_LIST_ACCESS',
      resource: 'admin',
      outcome: 'SUCCESS',
      details: { userCount: users.length },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: sessionData.session.id
    });

    return NextResponse.json({ users });

  } catch (error) {
    console.error('Admin users list error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve users' },
      { status: 500 }
    );
  }
}
