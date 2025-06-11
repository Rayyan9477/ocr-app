import { processImage } from '../_utils/server-actions';

export async function POST(request) {
  try {
    const { filePath } = await request.json();
    
    // Basic validation
    if (!filePath || typeof filePath !== 'string') {
      return Response.json(
        { error: 'Invalid file path format' },
        { status: 400 }
      );
    }
    
    // Process the image
    const dimensions = await processImage(filePath);
    
    return Response.json({
      success: true,
      dimensions,
      width: dimensions[0],
      height: dimensions[1]
    });
  } catch (error) {
    console.error('Image processing error:', error);
    return Response.json(
      { error: error.message || 'Image processing failed' },
      { status: 500 }
    );
  }
}
