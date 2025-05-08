import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import { stat } from "fs/promises"

const execPromise = promisify(exec)

// Ensure upload and processed directories exist with proper permissions
const ensureDirectories = async () => {
  try {
    const uploadDir = join(process.cwd(), "uploads")
    const processedDir = join(process.cwd(), "processed")

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
      console.log(`Created upload directory: ${uploadDir}`)
    }

    if (!existsSync(processedDir)) {
      await mkdir(processedDir, { recursive: true })
      console.log(`Created processed directory: ${processedDir}`)
    }

    // Check if directories are writable
    try {
      const testFile = join(uploadDir, "test-write-permission.txt")
      await writeFile(testFile, "test")
      await readFile(testFile)
      console.log("Upload directory is writable")
    } catch (error) {
      console.error("Upload directory is not writable:", error)
      throw new Error("Upload directory is not writable")
    }

    // Also verify processed directory is writable
    try {
      const testProc = join(processedDir, "test-write-permission.txt")
      await writeFile(testProc, "test")
      await readFile(testProc)
      console.log("Processed directory is writable")
    } catch (error) {
      console.error("Processed directory is not writable:", error)
      throw new Error("Processed directory is not writable")
    }

    return { uploadDir, processedDir }
  } catch (error) {
    console.error("Error ensuring directories:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log("OCR API route called")

  try {
    // Ensure directories exist before processing
    const { uploadDir, processedDir } = await ensureDirectories()
    console.log("Directories ensured")

    // Parse form data
    const formData = await request.formData()
    console.log("Form data parsed")

    const file = formData.get("file") as File

    if (!file) {
      console.error("No file provided in form data")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes`)

    // Get command options from form data
    const language = (formData.get("language") as string) || "eng"
    const deskew = formData.get("deskew") === "true"
    const skipText = formData.get("skipText") === "true"
    const force = formData.get("force") === "true"
    const redoOcr = formData.get("redoOcr") === "true"
    const removeBackground = formData.get("removeBackground") === "true"
    const clean = formData.get("clean") === "true"
    const optimize = Number.parseInt((formData.get("optimize") as string) || "3")
    const rotate = (formData.get("rotate") as string) || "auto"
    const pdfRenderer = (formData.get("pdfRenderer") as string) || "auto"

    console.log("OCR options:", { language, deskew, skipText, force, redoOcr, removeBackground, clean, optimize, rotate, pdfRenderer })

    // Create unique filename
    const timestamp = Date.now()
    const originalFilename = file.name
    // Clean the filename to remove special characters that might cause issues
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileExtension = cleanFilename.split(".").pop() || "pdf"
    const filename = `${cleanFilename.replace(`.${fileExtension}`, "")}_${timestamp}`
    const inputFilePath = `${filename}.${fileExtension}`
    const outputFilePath = `${filename}_ocr.pdf`

    console.log("File paths:", { inputFilePath, outputFilePath })

    // Save the uploaded file
    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const inputPath = join(uploadDir, inputFilePath)
      await writeFile(inputPath, buffer)
      console.log(`File saved to ${inputPath}`)

      // Verify file was saved correctly
      const fileStats = await stat(inputPath)
      console.log(`File size on disk: ${fileStats.size} bytes`)

      if (fileStats.size === 0) {
        throw new Error("File was saved but has zero size")
      }
    } catch (error) {
      console.error("Error saving file:", error)
      return NextResponse.json(
        { error: "Failed to save uploaded file", details: (error as Error).message },
        { status: 500 },
      )
    }

    // In a real deployment with OCRmyPDF installed, use this code instead:
    try {
      // Build OCRmyPDF command
      let command = `ocrmypdf`
      
      if (language !== "eng") {
        command += ` --language ${language}`
      }
      
      if (deskew) {
        command += ` --deskew`
      }
      
      if (skipText) {
        command += ` --skip-text`
      }
      
      if (force) {
        command += ` --force-ocr`
      }
      if (redoOcr) {
        command += ` --redo-ocr`
      }
      if (removeBackground) {
        command += ` --remove-background`
      }
      if (clean) {
        command += ` --clean`
      }
      
      if (optimize > 0) {
        command += ` --optimize ${optimize}`
      }
      
      if (rotate !== "auto") {
        command += ` --rotate-pages ${rotate}`
      }
      if (pdfRenderer !== "auto") {
        command += ` --pdf-renderer ${pdfRenderer}`
      }
      
      const inputPath = join(uploadDir, inputFilePath)
      const outputPath = join(processedDir, outputFilePath)
      
      command += ` "${inputPath}" "${outputPath}"`
      
      console.log(`Executing command: ${command}`)
      const { stdout, stderr } = await execPromise(command)
      console.log("OCR process completed")
      
      return NextResponse.json({
        success: true,
        inputFile: inputFilePath,
        outputFile: outputFilePath,
        stdout,
        stderr,
      })
    } catch (error: any) {
      console.error("Error executing OCRmyPDF:", error)
      const stderrOutput = (error as any).stderr || ''
      // Detect if PDF already has text, retry with skip-text
      if (stderrOutput.toLowerCase().includes('already contains text')) {
        console.log('Auto-retrying OCR with --skip-text due to existing text')
        try {
          // retry command with skip-text
          const retryCmd = command + ' --skip-text'
          console.log(`Retry command: ${retryCmd}`)
          const { stdout: rstdout, stderr: rstderr } = await execPromise(retryCmd)
          return NextResponse.json({ success: true, inputFile: inputFilePath, outputFile: outputFilePath, stdout: rstdout, stderr: rstderr })
        } catch (retryError: any) {
          console.error('Retry with skip-text failed:', retryError)
          return NextResponse.json(
            { success: false, errorType: 'has_text', error: 'PDF already contains text and skip-text retry failed', details: retryError.message },
            { status: 500 }
          )
        }
      }
      // Detect tagged PDF error, retry with force-ocr
      if (/tagged pdf/i.test(stderrOutput)) {
        console.log('Auto-retrying OCR with --force-ocr due to tagged PDF')
        try {
          // retry command with force-ocr
          const retryCmd = command + ' --force-ocr'
          console.log(`Retry command: ${retryCmd}`)
          const { stdout: rstdout, stderr: rstderr } = await execPromise(retryCmd)
          return NextResponse.json({ success: true, inputFile: inputFilePath, outputFile: outputFilePath, stdout: rstdout, stderr: rstderr })
        } catch (retryError: any) {
          console.error('Retry with force-ocr failed:', retryError)
          return NextResponse.json(
            { success: false, errorType: 'tagged_pdf', error: 'PDF is a tagged PDF and force-ocr retry failed', details: retryError.message },
            { status: 500 }
          )
        }
      }
      // Generic OCR error
      return NextResponse.json(
        { error: 'Failed to execute OCRmyPDF', details: (error as Error).message },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Unhandled error in OCR API route:", error)
    return NextResponse.json({ error: "Internal server error", details: (error as Error).message }, { status: 500 })
  }
}
