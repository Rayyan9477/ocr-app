import HIPAAOCRProcessor from '@/components/hipaa-ocr-processor';

export default function HIPAAOCRPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            HIPAA-Compliant OCR Processing
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Secure document processing with real-time logs, immediate downloads, and no data retention. 
            Fully compliant with HIPAA regulations for healthcare document processing.
          </p>
        </div>
        
        <HIPAAOCRProcessor />
      </div>
    </div>
  );
}
