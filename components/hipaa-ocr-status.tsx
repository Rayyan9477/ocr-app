'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface LogMessage {
  type: string;
  message: string;
  timestamp: string;
}

interface ProcessingStatus {
  stage: string;
  progress: number;
  details?: any;
}

export function OCRProcessingStatus({ processId }: { processId: string }) {
  const [status, setStatus] = useState<ProcessingStatus>({ stage: 'initializing', progress: 0 });
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!processId) return;

    const eventSource = new EventSource(`/api/hipaa-logs/stream?processId=${processId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'connected') {
        setLogs(prev => [...prev, {
          type: 'info',
          message: 'Connected to processing stream',
          timestamp: new Date().toISOString()
        }]);
      } else if (data.type === 'heartbeat') {
        // Ignore heartbeat messages
      } else if (data.action === 'OCR_PROCESSING') {
        setStatus({
          stage: data.details.stage,
          progress: getProgressFromStage(data.details.stage),
          details: data.details
        });
        
        setLogs(prev => [...prev, {
          type: 'info',
          message: `Processing: ${data.details.stage.replace(/_/g, ' ')}`,
          timestamp: data.timestamp
        }]);
      } else if (data.action === 'OCR_WARNING') {
        setLogs(prev => [...prev, {
          type: 'warning',
          message: data.details.warning,
          timestamp: data.timestamp
        }]);
        
        toast({
          title: 'Processing Warning',
          description: data.details.warning,
          variant: 'warning'
        });
      } else if (data.action === 'OCR_ERROR') {
        setLogs(prev => [...prev, {
          type: 'error',
          message: data.details.error,
          timestamp: data.timestamp
        }]);
        
        toast({
          title: 'Processing Error',
          description: data.details.error,
          variant: 'error'
        });

        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      toast({
        title: 'Connection Error',
        description: 'Lost connection to processing stream',
        variant: 'error'
      });
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [processId, toast]);

  const getProgressFromStage = (stage: string): number => {
    const stages = {
      'start_ocr': 10,
      'executing_ocr': 30,
      'ocr_complete': 60,
      'text_extraction': 70,
      'confidence_calculation': 80,
      'cleanup': 90,
      'complete': 100
    };
    return stages[stage as keyof typeof stages] || 0;
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Processing Status</h3>
          <span className="text-sm text-muted-foreground">
            {status.progress}%
          </span>
        </div>
        <div className="w-full bg-secondary h-2 rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground capitalize">
          {status.stage.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="bg-muted p-4 rounded-lg max-h-[300px] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">Processing Logs</h3>
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`text-sm p-2 rounded ${
                log.type === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : log.type === 'warning'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-secondary'
              }`}
            >
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <p className="mt-1">{log.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
