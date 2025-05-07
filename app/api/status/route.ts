import { NextResponse } from "next/server"
import { readdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET() {
  try {
    const processedDir = join(process.cwd(), "processed")

    // Check if directory exists
    if (!existsSync(processedDir)) {
      return NextResponse.json({ files: [] })
    }

    // Read directory
    const files = await readdir(processedDir)

    // Filter for PDF files
    const pdfFiles = files.filter((file) => file.endsWith(".pdf"))

    return NextResponse.json({
      success: true,
      files: pdfFiles.map((file) => ({
        name: file,
        path: `/api/download?file=${encodeURIComponent(file)}`,
      })),
    })
  } catch (error) {
    console.error("Error getting status:", error)
    return NextResponse.json({ error: "Failed to get status", details: (error as Error).message }, { status: 500 })
  }
}
