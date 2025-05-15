import { forwardRef, useState } from "react"
import { Terminal as TerminalIcon, Copy, CheckCircle, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface TerminalProps {
  output: string
  progress?: number
  status?: string
}

export const Terminal = forwardRef<HTMLDivElement, TerminalProps>(({ output, progress, status }, ref) => {
  const [copied, setCopied] = useState(false);
  
  // Process output to add color highlighting
  const processOutput = (text: string) => {
    if (!text) return null;
    
    return text.split('\n').map((line, index) => {
      let className = '';
      
      if (line.includes('❌') || line.includes('Error') || line.includes('error') || line.includes('failed')) {
        className = 'text-red-400';
      } else if (line.includes('⚠️') || line.includes('Warning') || line.includes('warning')) {
        className = 'text-yellow-400';
      } else if (line.includes('✅') || line.includes('Success') || line.includes('success')) {
        className = 'text-green-400';
      } else if (line.includes('ℹ️') || line.includes('Info:') || line.startsWith('File')) {
        className = 'text-blue-300';
      }
      
      return <div key={index} className={className}>{line}</div>;
    });
  };
  
  const copyToClipboard = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-black text-green-400 rounded-md h-[500px] flex flex-col" ref={ref}>
      <div className="flex items-center px-4 py-2 border-b border-gray-700 justify-between sticky top-0 bg-black z-10">
        <div className="flex items-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="ml-4 text-gray-400">OCRmyPDF Terminal</div>
          {status && (
            <div className="ml-4 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm text-primary">{status}</span>
            </div>
          )}
        </div>
        
        {output && (
          <Button 
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className={cn(
              "h-8 text-xs text-gray-400 hover:text-white hover:bg-gray-800",
              copied && "text-green-400"
            )}
          >
            {copied ? (
              <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Copied</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1" /> Copy Logs</>
            )}
          </Button>
        )}
      </div>

      {progress !== undefined && (
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-900">
          <div className="flex justify-between items-center mb-1 text-xs text-gray-400">
            <span>Processing Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {output ? (
          <div className="whitespace-pre-wrap space-y-1">
            {processOutput(output)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <TerminalIcon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center mb-2">Ready to process files</p>
            <p className="text-xs text-center max-w-sm opacity-70">
              Upload PDFs and click 'Start OCR Process' to begin. Terminal output will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

Terminal.displayName = "Terminal"
