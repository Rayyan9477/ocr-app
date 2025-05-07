import { forwardRef } from "react"

interface TerminalProps {
  output: string
}

export const Terminal = forwardRef<HTMLDivElement, TerminalProps>(({ output }, ref) => {
  return (
    <div className="bg-black text-green-400 p-4 rounded-md h-[500px] overflow-auto font-mono text-sm" ref={ref}>
      <div className="flex items-center mb-2 border-b border-gray-700 pb-2">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="ml-4 text-gray-400">OCRmyPDF Terminal</div>
      </div>
      <pre className="whitespace-pre-wrap">
        {output || "Ready to process files. Upload PDFs and click 'Process Files' to begin..."}
      </pre>
    </div>
  )
})

Terminal.displayName = "Terminal"
