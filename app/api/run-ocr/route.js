import { runOcrCommand } from '../_utils/server-actions';

export async function POST(request) {
  try {
    const { command } = await request.json();
    
    // Basic validation
    if (!command || typeof command !== 'string') {
      return Response.json(
        { error: 'Invalid OCR command format' },
        { status: 400 }
      );
    }
    
    // Run the OCR command
    const result = await runOcrCommand(command);
    
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error('OCR execution error:', error);
    return Response.json(
      { error: error.message || 'OCR execution failed' },
      { status: 500 }
    );
  }
}
