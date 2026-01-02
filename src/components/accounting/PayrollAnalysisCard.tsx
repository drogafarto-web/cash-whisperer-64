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
  Users,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import type { PayrollOcrResult } from '@/services/accountingValidationService';

interface PayrollAnalysisCardProps {
  result: PayrollOcrResult;
  fileName: string;
  status: 'processing' | 'ready' | 'applied' | 'error';
  onApply?: () => void;
  onRemove?: () => void;
  onEditSave?: (updatedResult: PayrollOcrResult) => void;
}

const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export function PayrollAnalysisCard({
  result,
  fileName,
  status,
  onApply,
  onRemove,
  onEditSave,
}: PayrollAnalysisCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    total_folha: result.total_folha ?? 0,
    encargos: result.encargos ?? 0,
    prolabore: result.prolabore ?? 0,
    num_funcionarios: result.num_funcionarios ?? 0,
    competencia_mes: result.competencia?.mes ?? 1,
    competencia_ano: result.competencia?.ano ?? new Date().getFullYear(),
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleStartEdit = () => {
    setEditValues({
      total_folha: result.total_folha ?? 0,
      encargos: result.encargos ?? 0,
      prolabore: result.prolabore ?? 0,
      num_funcionarios: result.num_funcionarios ?? 0,
      competencia_mes: result.competencia?.mes ?? 1,
      competencia_ano: result.competencia?.ano ?? new Date().getFullYear(),
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (onEditSave) {
      const updatedResult: PayrollOcrResult = {
        ...result,
        total_folha: editValues.total_folha,
        encargos: editValues.encargos,
        prolabore: editValues.prolabore || null,
        num_funcionarios: editValues.num_funcionarios || null,
        competencia: {
          mes: editValues.competencia_mes,
          ano: editValues.competencia_ano,
        },
      };
      onEditSave(updatedResult);
    }
    setIsEditing(false);
  };

  // Edit Mode
  if (isEditing) {
    return (
      <Card className="overflow-hidden">
        <div className="h-1 bg-blue-500" />
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">Editar Valores</span>
            </div>
            <Badge variant="secondary">Modo Edição</Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Total Folha</Label>
              <Input
                type="number"
                step="0.01"
                value={editValues.total_folha}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    total_folha: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Encargos</Label>
              <Input
                type="number"
                step="0.01"
                value={editValues.encargos}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    encargos: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pró-labore</Label>
              <Input
                type="number"
                step="0.01"
                value={editValues.prolabore}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    prolabore: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nº Funcionários</Label>
              <Input
                type="number"
                value={editValues.num_funcionarios}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    num_funcionarios: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select
                value={String(editValues.competencia_mes)}
                onValueChange={(v) =>
                  setEditValues((prev) => ({
                    ...prev,
                    competencia_mes: parseInt(v),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Input
                type="number"
                value={editValues.competencia_ano}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    competencia_ano: parseInt(e.target.value) || new Date().getFullYear(),
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View Mode
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-blue-500" />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon and Type */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Folha de Pagamento</span>
                {status === 'processing' && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analisando
                  </Badge>
                )}
                {status === 'ready' && (
                  <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
                    <FileSpreadsheet className="h-3 w-3" />
                    Pronto
                  </Badge>
                )}
                {status === 'applied' && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Aplicado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {fileName}
              </p>
            </div>
          </div>

          {/* Right: Funcionários + Edit button */}
          <div className="flex items-center gap-2">
            {result.num_funcionarios !== null && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {result.num_funcionarios} funcionário(s)
              </Badge>
            )}
            {status === 'ready' && onEditSave && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleStartEdit}
                title="Editar valores"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Values Grid */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Folha</p>
            <p className="font-semibold">{formatCurrency(result.total_folha)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Encargos</p>
            <p className="font-semibold">{formatCurrency(result.encargos)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Pró-labore</p>
            <p className="font-semibold">{formatCurrency(result.prolabore)}</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Competência</p>
            <p className="font-semibold">
              {result.competencia 
                ? `${result.competencia.mes.toString().padStart(2, '0')}/${result.competencia.ano}`
                : '—'}
            </p>
          </div>
        </div>

        {/* Confidence */}
        <div className={`mt-2 text-xs ${getConfidenceColor(result.confidence)}`}>
          Confiança da análise: {Math.round(result.confidence * 100)}%
        </div>

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
            {onApply && (
              <Button size="sm" onClick={onApply} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Aplicar Valores
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
