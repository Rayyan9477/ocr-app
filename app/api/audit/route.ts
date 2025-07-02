import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check admin permissions for audit access
    const user = await authService.getUserById(session.userId);
    if (!user || user.role !== 'admin') {
      await auditLogger.logEvent({
        userId: session.userId,
        userRole: user?.role || 'unknown',
        action: 'ACCESS_DENIED',
        resource: 'audit-logs',
        outcome: 'FAILURE',
        details: { reason: 'Admin access required' },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId: session.id
      });

      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const userId = url.searchParams.get('userId');
    const action = url.searchParams.get('action');
    const outcome = url.searchParams.get('outcome') as 'SUCCESS' | 'FAILURE' | undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build filter options
    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (outcome) filters.outcome = outcome;

    // Get audit logs
    const auditLogs = await auditLogger.getAuditLogs(filters, limit, offset);
    
    // Get summary statistics
    const stats = await auditLogger.getAuditStats(filters);

    // Log audit access
    await auditLogger.logEvent({
      userId: session.userId,
      userRole: user.role,
      action: 'FILE_ACCESS',
      resource: 'audit-logs',
      outcome: 'SUCCESS',
      details: { 
        filters,
        resultCount: auditLogs.length,
        accessedBy: user.email
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: session.id
    });

    return NextResponse.json({
      success: true,
      auditLogs,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.totalEvents
      }
    });

  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check admin permissions
    const user = await authService.getUserById(session.userId);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { format, filters } = await request.json();

    // Export audit logs
    const exportData = await auditLogger.exportAuditLogs(filters, format);

    // Log export action
    await auditLogger.logEvent({
      userId: session.userId,
      userRole: user.role,
      action: 'FILE_DOWNLOAD',
      resource: 'audit-export',
      outcome: 'SUCCESS',
      details: { 
        format,
        filters,
        exportedBy: user.email,
        exportSize: exportData.length
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: session.id
    });

    return NextResponse.json({
      success: true,
      data: exportData,
      format,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Audit export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
