import { type NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { stat } from "fs/promises"

export async function GET(request: NextRequest) {
  console.log("Download API route called")

  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("file")

    if (!filename) {
      console.error("No filename provided in request")
      return NextResponse.json({ error: "No filename provided" }, { status: 400 })
    }

    console.log(`Requested file: ${filename}`)

    const processedDir = join(process.cwd(), "processed")
    const filePath = join(processedDir, filename)

    console.log(`Looking for file at: ${filePath}`)

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    try {
      // Get file stats for Content-Length header
      const stats = await stat(filePath)
      console.log(`File size: ${stats.size} bytes`)

      // Read file
      const fileBuffer = await readFile(filePath)
      console.log(`Read ${fileBuffer.length} bytes from file`)

      // Return file as response with proper headers
      console.log("Sending file as response")
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
          "Content-Length": stats.size.toString(),
          // Disable caching to ensure fresh content
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })
    } catch (fileError) {
      console.error(`Error reading file: ${fileError}`)
      return NextResponse.json({ error: "Error reading file", details: (fileError as Error).message }, { status: 500 })
    }
  } catch (error) {
    console.error("Unhandled error in download route:", error)
    return NextResponse.json({ error: "Failed to download file", details: (error as Error).message }, { status: 500 })
  }
}
