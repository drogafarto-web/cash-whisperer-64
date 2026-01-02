import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/formats';
import { Users, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export interface Colaborador {
  id: string;
  name: string;
  expected_amount: number | null;
  default_category_id?: string | null;
}

export interface PayrollData {
  total_folha: number;
  num_funcionarios: number | null;
  competencia: string;
  fileName: string;
  filePath: string | null;
}

interface PayrollAssignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradores: Colaborador[];
  payrollData: PayrollData;
  onConfirm: (selectedIds: string[]) => Promise<void>;
  onSkip: () => Promise<void>;
  isLoading?: boolean;
}

export function PayrollAssignModal({
  open,
  onOpenChange,
  colaboradores,
  payrollData,
  onConfirm,
  onSkip,
  isLoading = false,
}: PayrollAssignModalProps) {
  // Pre-select all colaboradores with valid salary
  const [selectedIds, setSelectedIds] = useState<string[]>(() => 
    colaboradores.filter(c => c.expected_amount && c.expected_amount > 0).map(c => c.id)
  );

  // Calculate totals
  const totalSelected = useMemo(() => {
    return colaboradores
      .filter(c => selectedIds.includes(c.id))
      .reduce((sum, c) => sum + (c.expected_amount || 0), 0);
  }, [colaboradores, selectedIds]);

  const difference = payrollData.total_folha - totalSelected;
  const isMatch = Math.abs(difference) < 0.01;
  const isClose = Math.abs(difference) <= payrollData.total_folha * 0.05; // Within 5%

  const toggleColaborador = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(colaboradores.filter(c => c.expected_amount && c.expected_amount > 0).map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    await onConfirm(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vincular Folha a Colaboradores
          </DialogTitle>
          <DialogDescription>
            Selecione os colaboradores que fazem parte desta folha de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{payrollData.fileName}</p>
            <p className="text-sm text-muted-foreground">
              Competência: <span className="font-medium">{payrollData.competencia}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Total da Folha: <span className="font-medium text-foreground">{formatCurrency(payrollData.total_folha)}</span>
            </p>
          </div>

          {/* Colaboradores List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Colaboradores ({colaboradores.length})</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs">
                  Nenhum
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] rounded-md border p-2">
              <div className="space-y-2">
                {colaboradores.map((collab) => {
                  const hasValidSalary = collab.expected_amount && collab.expected_amount > 0;
                  return (
                    <div
                      key={collab.id}
                      className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors ${
                        selectedIds.includes(collab.id) ? 'bg-primary/5' : ''
                      } ${!hasValidSalary ? 'opacity-50' : ''}`}
                    >
                      <Checkbox
                        id={`collab-${collab.id}`}
                        checked={selectedIds.includes(collab.id)}
                        onCheckedChange={() => toggleColaborador(collab.id)}
                        disabled={!hasValidSalary}
                      />
                      <label
                        htmlFor={`collab-${collab.id}`}
                        className="flex-1 flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-sm font-medium">{collab.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {hasValidSalary 
                            ? formatCurrency(collab.expected_amount!) 
                            : <span className="text-amber-600">Sem salário</span>
                          }
                        </span>
                      </label>
                    </div>
                  );
                })}
                
                {colaboradores.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum colaborador cadastrado.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Totals Comparison */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total Selecionado:</span>
              <span className="font-semibold">{formatCurrency(totalSelected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total da Folha:</span>
              <span className="font-semibold">{formatCurrency(payrollData.total_folha)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Diferença:</span>
              <Badge 
                variant={isMatch ? "default" : isClose ? "secondary" : "destructive"}
                className="gap-1"
              >
                {isMatch ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Confere
                  </>
                ) : (
                  <>
                    {!isClose && <AlertCircle className="h-3 w-3" />}
                    {formatCurrency(Math.abs(difference))} {difference > 0 ? 'a menos' : 'a mais'}
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Warning if no colaborador selected */}
          {selectedIds.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Nenhum colaborador selecionado. Clique em "Criar Genérico" para criar uma conta a pagar única.
              </p>
            </div>
          )}

          {/* Hint for missing colaboradores */}
          {colaboradores.filter(c => !c.expected_amount).length > 0 && (
            <p className="text-xs text-muted-foreground">
              ⚠️ Colaboradores sem salário cadastrado não podem ser selecionados.{' '}
              <a href="/settings/partners" className="text-primary hover:underline">
                Cadastrar salários →
              </a>
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={onSkip}
            disabled={isLoading}
          >
            Criar Genérico
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || selectedIds.length === 0}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Vincular ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
