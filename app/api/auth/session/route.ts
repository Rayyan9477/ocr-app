import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/hipaa-auth-singleton';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    // Validate session
    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    // Get user details
    const user = await authService.getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role === 'admin' ? 'user' : user.role, // Hide admin role from client
        mfaEnabled: user.mfaEnabled
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
