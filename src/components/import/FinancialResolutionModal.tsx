import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { LisRecord, formatCurrency } from '@/utils/lisImport';
import { PaymentMethod } from '@/types/database';

export interface ResolutionData {
  paymentMethod: PaymentMethod;
  amount: number;
  justification: string;
}

interface FinancialResolutionModalProps {
  record: LisRecord | null;
  open: boolean;
  onClose: () => void;
  onResolve: (data: ResolutionData) => void;
}

export function FinancialResolutionModal({
  record,
  open,
  onClose,
  onResolve,
}: FinancialResolutionModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [errors, setErrors] = useState<{ paymentMethod?: string; amount?: string; justification?: string }>({});

  // Reset form when modal opens with new record
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  // Initialize amount when record changes
  useState(() => {
    if (record) {
      setAmount(record.valorBruto.toFixed(2).replace('.', ','));
      setPaymentMethod('');
      setJustification('');
      setErrors({});
    }
  });

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!paymentMethod) {
      newErrors.paymentMethod = 'Selecione a forma de pagamento';
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Informe um valor válido maior que zero';
    }

    if (!justification.trim() || justification.trim().length < 10) {
      newErrors.justification = 'Descreva o motivo da pendência (mínimo 10 caracteres)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    onResolve({
      paymentMethod: paymentMethod as PaymentMethod,
      amount: parsedAmount,
      justification: justification.trim(),
    });

    // Reset form
    setPaymentMethod('');
    setAmount('');
    setJustification('');
    setErrors({});
  };

  const handleClose = () => {
    setPaymentMethod('');
    setAmount('');
    setJustification('');
    setErrors({});
    onClose();
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Resolver Pendência Financeira
          </DialogTitle>
          <DialogDescription>
            Este atendimento está com situação financeira pendente no LIS.
            Para incluí-lo no fechamento de caixa, informe como foi resolvido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Record Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código:</span>
              <span className="font-mono">{record.codigo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paciente:</span>
              <span className="font-medium truncate max-w-[200px]">{record.paciente}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Convênio:</span>
              <span>{record.convenio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor original:</span>
              <span className="font-mono font-bold">{formatCurrency(record.valorBruto)}</span>
            </div>
          </div>

          {/* Alert Message */}
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <p className="text-sm text-destructive">
              ⚠️ O LIS indica que este atendimento não teve pagamento registrado.
              A atendente deve confirmar a resolução antes de incluir no fechamento.
            </p>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                setPaymentMethod(value as PaymentMethod);
                setErrors(prev => ({ ...prev, paymentMethod: undefined }));
              }}
            >
              <SelectTrigger className={errors.paymentMethod ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DINHEIRO">💵 Dinheiro</SelectItem>
                <SelectItem value="PIX">📱 PIX</SelectItem>
                <SelectItem value="CARTAO">💳 Cartão</SelectItem>
              </SelectContent>
            </Select>
            {errors.paymentMethod && (
              <p className="text-xs text-destructive">{errors.paymentMethod}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor Recebido (R$) *</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors(prev => ({ ...prev, amount: undefined }));
              }}
              placeholder="0,00"
              className={errors.amount ? 'border-destructive' : ''}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Justification */}
          <div className="space-y-2">
            <Label htmlFor="justification">Justificativa *</Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                setErrors(prev => ({ ...prev, justification: undefined }));
              }}
              placeholder="Descreva como a pendência foi resolvida..."
              rows={3}
              className={errors.justification ? 'border-destructive' : ''}
            />
            {errors.justification && (
              <p className="text-xs text-destructive">{errors.justification}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Ex: "Paciente pagou em dinheiro no caixa, mas não foi registrado no sistema"
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Resolver e Incluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
