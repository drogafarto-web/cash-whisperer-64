import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import labclinLogo from '@/assets/labclin-logo.png';

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isForced = searchParams.get('force') === 'true';
  
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user has a valid session (recovery or forced change)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        toast.error(isForced ? 'Sessão expirada. Faça login novamente.' : 'Link de recuperação inválido ou expirado');
        navigate('/auth');
      }
      setCheckingSession(false);
    };

    checkSession();
  }, [navigate, isForced]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    
    const { data: { user }, error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsLoading(false);
      toast.error('Erro ao atualizar senha. Tente novamente.');
      return;
    }

    // If this was a forced password change, update the profile flag
    if (isForced && user) {
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);
    }

    setIsLoading(false);
    toast.success('Senha atualizada com sucesso!');
    
    // Redirect to main app if forced change, otherwise to auth
    if (isForced) {
      navigate('/transactions');
    } else {
      navigate('/auth');
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img 
            src={labclinLogo} 
            alt="LabClin Logo" 
            className="w-20 h-20 object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">LabClin</h1>
            <p className="text-muted-foreground">Sistema de Gestão Financeira</p>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle>{isForced ? 'Criar Nova Senha' : 'Redefinir Senha'}</CardTitle>
            <CardDescription>
              {isForced 
                ? 'Por segurança, defina uma nova senha para acessar o sistema' 
                : 'Digite sua nova senha abaixo'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Atualizar Senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
