import { NextResponse } from "next/server"
import { readdir, stat } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// Add a helper function to create consistent JSON responses
const createJsonResponse = (data: any, status: number = 200) => {
  return new NextResponse(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

export async function GET() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function PUT() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE() {
  return new Response(
    JSON.stringify({ success: false, error: "Method Not Allowed" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
