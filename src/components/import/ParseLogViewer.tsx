import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, ChevronDown, ChevronUp, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface ParseLogViewerProps {
  logs: LogEntry[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const levelColors: Record<LogEntry['level'], string> = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

const levelIcons: Record<LogEntry['level'], React.ReactNode> = {
  info: <Info className="h-3 w-3" />,
  warn: <AlertTriangle className="h-3 w-3" />,
  error: <XCircle className="h-3 w-3" />,
  success: <CheckCircle2 className="h-3 w-3" />,
};

function formatTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`;
}

export function ParseLogViewer({ logs, isExpanded, onToggleExpand }: ParseLogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs appear
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  if (logs.length === 0) return null;

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <Card className="border-slate-700 bg-slate-900/50">
      <CardHeader className="py-3 px-4">
        <Button
          variant="ghost"
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
          onClick={onToggleExpand}
        >
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Terminal className="h-4 w-4 text-green-500" />
            Diagnóstico de Importação
            <span className="text-xs text-slate-500">({logs.length} mensagens)</span>
            {errorCount > 0 && (
              <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                {errorCount} erro{errorCount > 1 ? 's' : ''}
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full">
                {warnCount} aviso{warnCount > 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div
            ref={scrollRef}
            className="bg-slate-950 text-slate-100 p-3 rounded-lg max-h-64 overflow-y-auto font-mono text-xs space-y-0.5 border border-slate-800"
          >
            {logs.map((log, i) => (
              <div key={i} className={cn('py-0.5 flex items-start gap-2', levelColors[log.level])}>
                <span className="text-slate-600 shrink-0">{formatTime(log.timestamp)}</span>
                <span className="shrink-0">{levelIcons[log.level]}</span>
                <span className="break-words">{log.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
