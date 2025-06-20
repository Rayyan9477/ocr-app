# Extractable PDF UI Integration

This integration adds a user-friendly interface for the extractable PDF functionality, making it easily accessible throughout the application.

## Features

- **Dedicated Page**: A full-featured page at `/extractable-pdf` for processing PDFs
- **Navigation Integration**: Accessible from the main navigation menu
- **Quick Access Button**: Added to the home page for easy discovery
- **Floating Action Button**: Always accessible from any page
- **API Endpoint**: Backend processing with progress feedback

## UI Components

1. **Main Extractable PDF Page**: 
   - File upload with drag-and-drop support
   - Processing options (layout preservation, OCR enhancement, etc.)
   - Progress tracking
   - Download of processed PDFs

2. **Quick Access Card**:
   - Information about the feature
   - Link to the dedicated page
   - Visual indicator of functionality

3. **Floating Action Button**:
   - Fixed position for easy access
   - Tooltip for feature explanation
   - One-click access to the PDF processing page

4. **Navigation Menu Item**:
   - Integration in the main navigation
   - Available on desktop and mobile views

## API Integration

The UI components connect to the `/api/extract-pdf` endpoint, which:

1. Accepts PDF uploads via FormData
2. Processes the PDF with OLMOCR
3. Makes the text extractable while preserving appearance
4. Returns a download link to the processed file

## Usage

Users can access the extractable PDF functionality in multiple ways:

1. Click the "Extractable PDF" item in the main navigation
2. Use the floating action button from any page
3. Click the quick access card on the home page
4. Use the button in the top section of the home page

## Technical Implementation

The UI is built with:
- React components with Next.js
- Tailwind CSS for styling
- Radix UI primitives
- Lucide React icons
- Form validation and file handling
- Progress feedback for long-running operations
