import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NoActiveUnitMessageProps {
  onGoToDashboard?: () => void;
}

/**
 * Componente exibido quando o usuário não tem unidade ativa selecionada
 */
export function NoActiveUnitMessage({ onGoToDashboard }: NoActiveUnitMessageProps) {
  const navigate = useNavigate();

  const handleGoToDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Nenhuma Unidade Selecionada
            </h2>
            <p className="text-muted-foreground">
              Você precisa estar vinculado a uma unidade para acessar esta funcionalidade.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">O que fazer?</p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com o administrador do sistema para vincular seu usuário a uma unidade.
                </p>
              </div>
            </div>
          </div>
          <Button onClick={handleGoToDashboard}>
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
