import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface MarkAsPaidModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: {
    id: string;
    beneficiario: string;
    valor: number;
    payment_bank_account_id?: string | null;
  } | null;
  accounts: Array<{ id: string; name: string; institution?: string | null }>;
  onConfirm: (payableId: string, paidAt: string, paymentAccountId?: string) => void;
  isPending?: boolean;
}

export function MarkAsPaidModal({
  open,
  onOpenChange,
  payable,
  accounts,
  onConfirm,
  isPending = false,
}: MarkAsPaidModalProps) {
  const [paidDate, setPaidDate] = useState<Date>(new Date());
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    payable?.payment_bank_account_id || ''
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleConfirm = () => {
    if (!payable) return;
    const paidAt = paidDate.toISOString();
    onConfirm(
      payable.id,
      paidAt,
      selectedAccountId && selectedAccountId !== 'none' ? selectedAccountId : undefined
    );
  };

  // Reset state when modal opens with new payable
  const handleOpenChange = (open: boolean) => {
    if (open && payable) {
      setPaidDate(new Date());
      setSelectedAccountId(payable.payment_bank_account_id || '');
    }
    onOpenChange(open);
  };

  if (!payable) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Confirmar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payable Info */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="font-medium">{payable.beneficiario}</p>
            <p className="text-lg font-bold text-primary">
              {payable.valor.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Data do Pagamento</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !paidDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paidDate
                    ? format(paidDate, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paidDate}
                  onSelect={(date) => {
                    if (date) {
                      setPaidDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Payment Account */}
          <div className="space-y-2">
            <Label>Conta de Origem</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificado</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                    {account.institution && ` (${account.institution})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar Pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
