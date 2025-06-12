import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { serverLogger } from "@/app/api/_utils/server-utils";
import { createJsonResponse } from "@/lib/utils";
import appConfig from "@/lib/config";

/**
 * Text content storage implementation (simple file-based)
 */
class TextContentStorage {
  private basePath: string;
  
  constructor() {
    // Use the processed directory by default
    this.basePath = appConfig.processedDir || path.join(process.cwd(), 'processed');
    
    // Create a text-storage subdirectory
    const textStoragePath = path.join(this.basePath, 'text-storage');
    if (!fs.existsSync(textStoragePath)) {
      try {
        fs.mkdirSync(textStoragePath, { recursive: true });
      } catch (error) {
        serverLogger.error(`Failed to create text storage directory: ${error}`);
      }
    }
    
    this.basePath = textStoragePath;
  }
  
  /**
   * Get the file path for a content ID
   */
  private getFilePath(id: string): string {
    // Sanitize the ID to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.basePath, `${safeId}.txt`);
  }
  
  /**
   * Store text content
   */
  async storeText(id: string, content: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.promises.writeFile(filePath, content, 'utf8');
      return true;
    } catch (error) {
      serverLogger.error(`Failed to store text content: ${error}`);
      return false;
    }
  }
  
  /**
   * Retrieve text content
   */
  async retrieveText(id: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(id);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      serverLogger.error(`Failed to retrieve text content: ${error}`);
      return null;
    }
  }
  
  /**
   * Delete text content
   */
  async deleteText(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      
      if (!fs.existsSync(filePath)) {
        return true; // Already deleted
      }
      
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      serverLogger.error(`Failed to delete text content: ${error}`);
      return false;
    }
  }
}

// Create the storage instance
const textStorage = new TextContentStorage();

/**
 * GET handler for retrieving text content
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return createJsonResponse({ success: false, error: 'No content ID provided' }, 400);
  }
  
  try {
    const content = await textStorage.retrieveText(id);
    
    if (content === null) {
      return createJsonResponse({ 
        success: false, 
        error: 'Text content not found',
        id
      }, 404);
    }
    
    return createJsonResponse({ 
      success: true, 
      text: content,
      id
    });
  } catch (error) {
    serverLogger.error(`Error retrieving text content ${id}:`, error);
    return createJsonResponse({ 
      success: false, 
      error: 'Failed to retrieve text content',
      details: error instanceof Error ? error.message : String(error),
      id
    }, 500);
  }
}

/**
 * POST handler for storing text content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return createJsonResponse({ success: false, error: 'No content ID provided' }, 400);
  }
  
  try {
    const data = await request.json();
    
    if (!data.text) {
      return createJsonResponse({ success: false, error: 'No text content provided' }, 400);
    }
    
    const success = await textStorage.storeText(id, data.text);
    
    if (!success) {
      return createJsonResponse({ 
        success: false, 
        error: 'Failed to store text content',
        id
      }, 500);
    }
    
    return createJsonResponse({ 
      success: true, 
      message: 'Text content stored successfully',
      id
    });
  } catch (error) {
    serverLogger.error(`Error storing text content ${id}:`, error);
    return createJsonResponse({ 
      success: false, 
      error: 'Failed to store text content',
      details: error instanceof Error ? error.message : String(error),
      id
    }, 500);
  }
}

/**
 * DELETE handler for removing text content
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return createJsonResponse({ success: false, error: 'No content ID provided' }, 400);
  }
  
  try {
    const success = await textStorage.deleteText(id);
    
    if (!success) {
      return createJsonResponse({ 
        success: false, 
        error: 'Failed to delete text content',
        id
      }, 500);
    }
    
    return createJsonResponse({ 
      success: true, 
      message: 'Text content deleted successfully',
      id
    });
  } catch (error) {
    serverLogger.error(`Error deleting text content ${id}:`, error);
    return createJsonResponse({ 
      success: false, 
      error: 'Failed to delete text content',
      details: error instanceof Error ? error.message : String(error),
      id
    }, 500);
  }
}
