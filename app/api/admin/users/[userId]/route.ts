import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

// Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('hipaa-session')?.value;
    const { isActive, role } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionData = await authService.validateSessionWithUser(token);
    if (!sessionData || sessionData.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Update the user
    const updatedUser = await authService.updateUser(params.userId, { isActive, role });
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the admin action
    await auditLogger.logEvent({
      userId: sessionData.user.id,
      userRole: sessionData.user.role,
      action: 'USER_UPDATE',
      resource: 'admin',
      outcome: 'SUCCESS',
      details: { 
        targetUserId: params.userId,
        updates: { isActive, role }
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: sessionData.session.id
    });

    return NextResponse.json({ success: true, user: updatedUser });

  } catch (error) {
    console.error('Admin user update error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    // Delete the user
    const deleted = await authService.deleteUser(params.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found or cannot be deleted' }, { status: 404 });
    }

    // Log the admin action
    await auditLogger.logEvent({
      userId: sessionData.user.id,
      userRole: sessionData.user.role,
      action: 'USER_DELETE',
      resource: 'admin',
      outcome: 'SUCCESS',
      details: { 
        targetUserId: params.userId
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: sessionData.session.id
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Admin user delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
