import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface AlertPreferences {
  id?: string;
  user_id: string;
  email_fator_r_critico: boolean;
  email_fator_r_alerta: boolean;
  limite_alerta_preventivo: number;
  frequencia: 'imediato' | 'diario' | 'semanal';
}

export function AlertPreferencesCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [preferences, setPreferences] = useState<AlertPreferences>({
    user_id: user?.id || '',
    email_fator_r_critico: true,
    email_fator_r_alerta: true,
    limite_alerta_preventivo: 0.30,
    frequencia: 'imediato',
  });

  // Fetch existing preferences
  const { data: savedPreferences, isLoading } = useQuery({
    queryKey: ['alert-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Update preferences when data loads
  useEffect(() => {
    if (savedPreferences) {
      setPreferences({
        id: savedPreferences.id,
        user_id: savedPreferences.user_id,
        email_fator_r_critico: savedPreferences.email_fator_r_critico,
        email_fator_r_alerta: savedPreferences.email_fator_r_alerta,
        limite_alerta_preventivo: Number(savedPreferences.limite_alerta_preventivo),
        frequencia: savedPreferences.frequencia as 'imediato' | 'diario' | 'semanal',
      });
    } else if (user?.id) {
      setPreferences(prev => ({ ...prev, user_id: user.id }));
    }
  }, [savedPreferences, user?.id]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: AlertPreferences) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const dataToSave = {
        user_id: user.id,
        email_fator_r_critico: prefs.email_fator_r_critico,
        email_fator_r_alerta: prefs.email_fator_r_alerta,
        limite_alerta_preventivo: prefs.limite_alerta_preventivo,
        frequencia: prefs.frequencia,
      };
      
      if (prefs.id) {
        // Update existing
        const { error } = await supabase
          .from('alert_preferences')
          .update(dataToSave)
          .eq('id', prefs.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('alert_preferences')
          .insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-preferences'] });
      toast.success('Preferências de alertas salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving preferences:', error);
      toast.error('Erro ao salvar preferências');
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase.functions.invoke('send-fator-r-alert', {
        body: {
          test: true,
          userId: user.id,
          fatorRAtual: 0.25,
          tipoAlerta: 'CAIU_ABAIXO_28',
        },
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email de teste enviado! Verifique sua caixa de entrada.');
    },
    onError: (error) => {
      console.error('Error sending test email:', error);
      toast.error('Erro ao enviar email de teste');
    },
  });

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configurações de Alertas de Fator R
        </CardTitle>
        <CardDescription>
          Receba notificações por email quando o Fator R se aproximar de limites críticos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert type toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Alerta Crítico (Fator R &lt; 28%)
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando cair para o Anexo V
              </p>
            </div>
            <Switch
              checked={preferences.email_fator_r_critico}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, email_fator_r_critico: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Alerta Preventivo
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando se aproximar do limite
              </p>
            </div>
            <Switch
              checked={preferences.email_fator_r_alerta}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, email_fator_r_alerta: checked }))
              }
            />
          </div>
        </div>

        {/* Preventive threshold slider */}
        {preferences.email_fator_r_alerta && (
          <div className="space-y-3">
            <Label>
              Limite de alerta preventivo: 
              <Badge variant="outline" className="ml-2">
                {(preferences.limite_alerta_preventivo * 100).toFixed(0)}%
              </Badge>
            </Label>
            <Slider
              value={[preferences.limite_alerta_preventivo * 100]}
              onValueChange={([value]) => 
                setPreferences(prev => ({ ...prev, limite_alerta_preventivo: value / 100 }))
              }
              min={28}
              max={35}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>28% (Limite)</span>
              <span>35% (Mais cedo)</span>
            </div>
          </div>
        )}

        {/* Frequency selector */}
        <div className="space-y-2">
          <Label>Frequência de verificação</Label>
          <Select
            value={preferences.frequencia}
            onValueChange={(value: 'imediato' | 'diario' | 'semanal') => 
              setPreferences(prev => ({ ...prev, frequencia: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imediato">Imediato (a cada cálculo)</SelectItem>
              <SelectItem value="diario">Diário (resumo às 8h)</SelectItem>
              <SelectItem value="semanal">Semanal (toda segunda-feira)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Email info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>Alertas serão enviados para: {user.email}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => saveMutation.mutate(preferences)}
            disabled={saveMutation.isPending}
            className="flex-1"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Preferências
          </Button>
          
          <Button
            variant="outline"
            onClick={() => testEmailMutation.mutate()}
            disabled={testEmailMutation.isPending}
          >
            {testEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Testar Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
