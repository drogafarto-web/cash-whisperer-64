import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileCheck2,
  AlertTriangle,
  Lightbulb,
  Receipt,
  CheckCircle2,
  XCircle,
  Loader2,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import type { TaxGuideOcrResult } from '@/services/accountingValidationService';

const TAX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  das: { label: 'DAS', color: 'bg-blue-500', icon: <Receipt className="h-4 w-4" /> },
  darf: { label: 'DARF', color: 'bg-purple-500', icon: <Receipt className="h-4 w-4" /> },
  gps: { label: 'GPS', color: 'bg-orange-500', icon: <Receipt className="h-4 w-4" /> },
  inss: { label: 'INSS', color: 'bg-teal-500', icon: <Receipt className="h-4 w-4" /> },
  fgts: { label: 'FGTS', color: 'bg-green-500', icon: <Receipt className="h-4 w-4" /> },
  iss: { label: 'ISS', color: 'bg-red-500', icon: <Receipt className="h-4 w-4" /> },
  outro: { label: 'Documento', color: 'bg-gray-500', icon: <FileCheck2 className="h-4 w-4" /> },
};

const TAX_TYPES = ['das', 'darf', 'gps', 'inss', 'fgts', 'iss'] as const;
type TaxDocType = 'darf' | 'das' | 'fgts' | 'folha' | 'gps' | 'inss' | 'iss' | 'outro';

interface TaxGuideResultCardProps {
  result: TaxGuideOcrResult;
  fileName: string;
  status: 'processing' | 'ready' | 'applied' | 'error';
  onApply?: () => void;
  isApplying?: boolean;
  onRemove?: () => void;
  onEditSave?: (updatedResult: TaxGuideOcrResult) => void;
}

export function TaxGuideResultCard({
  result,
  fileName,
  status,
  onApply,
  isApplying,
  onRemove,
  onEditSave,
}: TaxGuideResultCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<{
    tipo_documento: TaxDocType;
    valor: number;
    vencimento: string;
  }>({
    tipo_documento: result.tipo_documento,
    valor: result.valor ?? 0,
    vencimento: result.vencimento ?? '',
  });
  
  const config = TAX_TYPE_CONFIG[result.tipo_documento] || TAX_TYPE_CONFIG.outro;

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const handleStartEdit = () => {
    setEditValues({
      tipo_documento: result.tipo_documento,
      valor: result.valor ?? 0,
      vencimento: result.vencimento ?? '',
    });
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  const handleSaveEdit = () => {
    if (onEditSave) {
      const updatedResult: TaxGuideOcrResult = {
        ...result,
        tipo_documento: editValues.tipo_documento,
        valor: editValues.valor,
        vencimento: editValues.vencimento || null,
      };
      onEditSave(updatedResult);
    }
    setIsEditing(false);
  };
  
  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: string | null) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${config.color}`} />
      <CardContent className="p-4">
        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Editar Valores</span>
              <Badge variant="outline" className="text-xs">Modo Edição</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Guia</Label>
                <Select
                  value={editValues.tipo_documento}
                  onValueChange={(v) => setEditValues(prev => ({ ...prev, tipo_documento: v as TaxDocType }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editValues.valor}
                  onChange={(e) => setEditValues(prev => ({ 
                    ...prev, 
                    valor: parseFloat(e.target.value) || 0 
                  }))}
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Input
                  type="date"
                  value={formatDateForInput(editValues.vencimento)}
                  onChange={(e) => setEditValues(prev => ({ 
                    ...prev, 
                    vencimento: e.target.value 
                  }))}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="gap-1">
                <X className="h-3 w-3" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                <Save className="h-3 w-3" />
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <>
            <div className="flex items-start justify-between gap-3">
              {/* Left: Icon and Type */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color} text-white`}>
                  {config.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{config.label}</span>
                    {status === 'processing' && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processando
                      </Badge>
                    )}
                    {status === 'ready' && (
                      <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                        <FileCheck2 className="h-3 w-3" />
                        Pronto
                      </Badge>
                    )}
                    {status === 'applied' && (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Aplicado
                      </Badge>
                    )}
                    {status === 'error' && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Erro
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {fileName}
                  </p>
                </div>
              </div>

              {/* Right: Value and Due Date */}
              <div className="text-right">
                <p className="text-lg font-bold">{formatCurrency(result.valor)}</p>
                {result.vencimento && (
                  <p className="text-xs text-muted-foreground">
                    Venc: {formatDate(result.vencimento)}
                  </p>
                )}
              </div>
            </div>

            {/* Additional Info */}
            {(result.competencia || result.cnpj_contribuinte) && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
                {result.competencia && (
                  <div>
                    <span className="font-medium">Competência:</span>{' '}
                    {result.competencia.mes.toString().padStart(2, '0')}/{result.competencia.ano}
                  </div>
                )}
                {result.cnpj_contribuinte && (
                  <div>
                    <span className="font-medium">CNPJ:</span> {result.cnpj_contribuinte}
                  </div>
                )}
                <div className={getConfidenceColor(result.confidence)}>
                  <span className="font-medium">Confiança:</span> {Math.round(result.confidence * 100)}%
                </div>
              </div>
            )}

            {/* Alerts */}
            {result.alertas && result.alertas.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.alertas.map((alerta, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-800 dark:text-yellow-200"
                  >
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{alerta}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI Suggestion */}
            {result.sugestao && (
              <div className="mt-3 flex items-start gap-2 p-2 bg-primary/5 rounded-lg">
                <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary">Sugestão da IA</p>
                  <p className="text-xs text-muted-foreground">{result.sugestao}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            {status === 'ready' && (
              <div className="mt-3 flex justify-end gap-2">
                {onRemove && (
                  <Button variant="ghost" size="sm" onClick={onRemove}>
                    Remover
                  </Button>
                )}
                {onEditSave && (
                  <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-1">
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                )}
                {onApply && (
                  <Button size="sm" onClick={onApply} disabled={isApplying} className="gap-1">
                    {isApplying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aplicar Valores
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
