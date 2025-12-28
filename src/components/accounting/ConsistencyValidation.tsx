import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ConsistencyCheck } from '@/services/accountingValidationService';

interface ConsistencyValidationProps {
  checks: ConsistencyCheck[];
  isLoading?: boolean;
}

export function ConsistencyValidation({ checks, isLoading }: ConsistencyValidationProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const okChecks = checks.filter((c) => c.status === 'ok');
  const warningChecks = checks.filter((c) => c.status === 'warning');
  const errorChecks = checks.filter((c) => c.status === 'error');

  const overallStatus = errorChecks.length > 0 
    ? 'error' 
    : warningChecks.length > 0 
      ? 'warning' 
      : 'ok';

  const getStatusIcon = (status: ConsistencyCheck['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBg = (status: ConsistencyCheck['status']) => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
    }
  };

  const getOverallBadge = () => {
    switch (overallStatus) {
      case 'ok':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Tudo certo
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <AlertTriangle className="h-3 w-3" />
            {warningChecks.length} atenção
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {errorChecks.length} problema(s)
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Validando consistência...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checks.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validação de Consistência
          </CardTitle>
          <div className="flex items-center gap-2">
            {getOverallBadge()}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          <div className="space-y-2">
            {/* Errors first */}
            {errorChecks.map((check) => (
              <div
                key={check.id}
                className={`flex items-start gap-2 p-2 rounded-lg ${getStatusBg(check.status)}`}
              >
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}

            {/* Warnings second */}
            {warningChecks.map((check) => (
              <div
                key={check.id}
                className={`flex items-start gap-2 p-2 rounded-lg ${getStatusBg(check.status)}`}
              >
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}

            {/* OK checks collapsed by default if there are warnings/errors */}
            {overallStatus === 'ok' && okChecks.map((check) => (
              <div
                key={check.id}
                className={`flex items-start gap-2 p-2 rounded-lg ${getStatusBg(check.status)}`}
              >
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}

            {/* Summary if there are OK checks hidden */}
            {overallStatus !== 'ok' && okChecks.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  {okChecks.length} validação(ões) OK
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
