import { NextRequest, NextResponse } from 'next/server';
import { runCommand } from '@/app/api/_utils/server-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { command?: string };
    const { command } = body;
    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid command' },
        { status: 400 }
      );
    }
    const output = await runCommand(command);
    return NextResponse.json({ success: true, output });
  } catch (error) {
    console.error('Error executing command:', error);
    return NextResponse.json(
      { success: false, error: (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
