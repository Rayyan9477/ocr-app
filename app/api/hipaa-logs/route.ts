import { NextRequest, NextResponse } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

// In-memory store for processing logs (use Redis/database in production)
const processingLogs = new Map<string, Array<{
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}>>();

// Add log entry
export function addProcessingLog(
  sessionId: string,
  level: 'info' | 'warning' | 'error' | 'success',
  message: string,
  details?: any
) {
  if (!processingLogs.has(sessionId)) {
    processingLogs.set(sessionId, []);
  }
  
  const logs = processingLogs.get(sessionId)!;
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    details
  });
  
  // Keep only last 1000 logs per session
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
}

// Clear logs for session (called when processing completes)
export function clearProcessingLogs(sessionId: string) {
  processingLogs.delete(sessionId);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const stream = searchParams.get('stream') === 'true';
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

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

    const userId = session.userId;

    // Check permissions
    const hasPermission = await authService.checkPermission(
      userId,
      'file',
      'upload'
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Return logs or stream
    if (stream) {
      // Server-Sent Events for real-time logs
      const encoder = new TextEncoder();
      
      const customReadable = new ReadableStream({
        start(controller) {
          // Send existing logs first
          const existingLogs = processingLogs.get(sessionId) || [];
          for (const log of existingLogs) {
            const data = `data: ${JSON.stringify(log)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Set up polling for new logs
          const interval = setInterval(() => {
            const logs = processingLogs.get(sessionId) || [];
            const recentLogs = logs.slice(-10); // Get last 10 logs
            
            for (const log of recentLogs) {
              const data = `data: ${JSON.stringify(log)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }, 1000);

          // Cleanup after 5 minutes
          setTimeout(() => {
            clearInterval(interval);
            controller.close();
          }, 300000);
        },
      });

      return new NextResponse(customReadable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-HIPAA-Compliant': 'true',
        },
      });
    } else {
      // Return all logs as JSON
      const logs = processingLogs.get(sessionId) || [];
      
      await auditLogger.logEvent({
        userId,
        userRole: 'user',
        action: 'LOGS_ACCESS',
        resource: 'hipaa-logs',
        outcome: 'SUCCESS',
        details: { 
          sessionId,
          logCount: logs.length,
          accessTime: new Date().toISOString()
        },
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        sessionId: session.id
      });

      return NextResponse.json({
        success: true,
        sessionId,
        logs,
        totalLogs: logs.length,
        latestTimestamp: logs.length > 0 ? logs[logs.length - 1].timestamp : null
      });
    }

  } catch (error) {
    console.error('HIPAA logs error:', error);
    
    await auditLogger.logEvent({
      userId: 'unknown',
      userRole: 'user',
      action: 'LOGS_ACCESS',
      resource: 'system',
      outcome: 'FAILURE',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      },
      ipAddress: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      sessionId: 'unknown'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow clearing logs manually
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

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

    clearProcessingLogs(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Logs cleared',
      sessionId
    });

  } catch (error) {
    console.error('HIPAA logs clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
