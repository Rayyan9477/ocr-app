"use client";

import ExtractablePdfConverter from "@/components/extractable-pdf-converter";

export default function ExtractablePdfPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Extractable PDF Converter</h1>
          <p className="text-muted-foreground mt-2">
            Process PDFs to make text fully extractable while preserving the original visual appearance.
          </p>
        </div>
        
        <div className="grid gap-6">
          <ExtractablePdfConverter />
          
          <div className="bg-muted p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Upload a PDF file using the form above.</li>
              <li>Configure processing options to suit your needs.</li>
              <li>Click "Make Extractable" to process the PDF.</li>
              <li>Download the resulting PDF, which looks the same but has extractable text.</li>
            </ol>
            
            <h3 className="text-lg font-semibold mt-6 mb-2">Key Benefits</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identical visual appearance to the original PDF</li>
              <li>Text becomes fully extractable and searchable</li>
              <li>Support for complex elements like tables and forms</li>
              <li>High-accuracy text recognition</li>
              <li>Optimized file size</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
