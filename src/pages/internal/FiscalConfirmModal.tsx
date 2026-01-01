import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Lock } from 'lucide-react';

interface FiscalConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FiscalConfirmModal({ open, onConfirm, onCancel }: FiscalConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle>Aviso de Confidencialidade</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <p>
              Este módulo contém <strong>dados fiscais sensíveis</strong> relacionados a 
              pagamentos informais que não entram no cálculo do Fator R.
            </p>
            <p>
              Ao continuar, você confirma que:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Está autorizado a acessar esses dados</li>
              <li>Não compartilhará ou exportará essas informações</li>
              <li>Seu acesso será registrado em log de auditoria</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <Lock className="h-4 w-4" />
            Confirmar Acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
