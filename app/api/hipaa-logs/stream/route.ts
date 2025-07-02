import { NextRequest } from 'next/server';
import { authService, auditLogger } from '@/lib/hipaa-auth-singleton';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const sessionToken = request.cookies.get('hipaa-session')?.value;
    if (!sessionToken) {
      return new Response('Authentication required', { status: 401 });
    }

    const session = await authService.validateSession(sessionToken);
    if (!session) {
      return new Response('Invalid session', { status: 401 });
    }

    // Get processing ID from query params
    const { searchParams } = new URL(request.url);
    const processId = searchParams.get('processId');
    if (!processId) {
      return new Response('Processing ID required', { status: 400 });
    }

    // Set up SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    };

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        // Function to send SSE message
        const sendMessage = (data: any) => {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Subscribe to process events
        const cleanup = auditLogger.subscribeToProcessEvents(processId, (event) => {
          sendMessage(event);
        });

        // Clean up subscription when client disconnects
        request.signal.addEventListener('abort', () => {
          cleanup();
          controller.close();
        });

        // Send initial connection message
        sendMessage({ type: 'connected', processId });

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
          sendMessage({ type: 'heartbeat', timestamp: new Date().toISOString() });
        }, 30000);

        // Clean up heartbeat when client disconnects
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
        });
      }
    });

    return new Response(stream, { headers });

  } catch (error) {
    console.error('HIPAA logs stream error:', error);
    return new Response(
      JSON.stringify({ error: 'Stream failed', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
