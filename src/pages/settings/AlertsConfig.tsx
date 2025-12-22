import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Save, TrendingUp, Users, Wallet, Building2 } from 'lucide-react';
import type { SystemConfig } from '@/types/database';

interface FatorRThresholds {
  verde: number;
  amarelo: number;
  vermelho: number;
}

interface FolhaInformalThresholds {
  alerta: number;
  critico: number;
}

interface CaixaDiferencaThreshold {
  valor: number;
}

interface CargaTributariaThreshold {
  percentual: number;
}

const AlertsConfig = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for each config
  const [fatorR, setFatorR] = useState<FatorRThresholds>({ verde: 0.32, amarelo: 0.28, vermelho: 0.25 });
  const [folhaInformal, setFolhaInformal] = useState<FolhaInformalThresholds>({ alerta: 0.10, critico: 0.20 });
  const [caixaDiferenca, setCaixaDiferenca] = useState<CaixaDiferencaThreshold>({ valor: 50 });
  const [cargaTributaria, setCargaTributaria] = useState<CargaTributariaThreshold>({ percentual: 0.15 });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/');
      toast.error('Acesso restrito a administradores');
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchConfigs();
    }
  }, [user, isAdmin]);

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('*');

      if (error) throw error;

      const configs = data as unknown as SystemConfig[];
      
      configs.forEach(config => {
        switch (config.key) {
          case 'fator_r_thresholds':
            setFatorR(config.value as unknown as FatorRThresholds);
            break;
          case 'folha_informal_max':
            setFolhaInformal(config.value as unknown as FolhaInformalThresholds);
            break;
          case 'caixa_diferenca_toleravel':
            setCaixaDiferenca(config.value as unknown as CaixaDiferencaThreshold);
            break;
          case 'carga_tributaria_max':
            setCargaTributaria(config.value as unknown as CargaTributariaThreshold);
            break;
        }
      });
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'fator_r_thresholds', value: JSON.parse(JSON.stringify(fatorR)) },
        { key: 'folha_informal_max', value: JSON.parse(JSON.stringify(folhaInformal)) },
        { key: 'caixa_diferenca_toleravel', value: JSON.parse(JSON.stringify(caixaDiferenca)) },
        { key: 'carga_tributaria_max', value: JSON.parse(JSON.stringify(cargaTributaria)) },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_config')
          .update({ 
            value: update.value,
            updated_at: new Date().toISOString(),
            updated_by: user?.id
          })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuração de Alertas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina os limites que disparam alertas visuais no dashboard e relatórios
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Fator R Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Fator R
              </CardTitle>
              <CardDescription>
                Limites para semáforo de Fator R (percentual folha/receita)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    Verde (bom)
                  </Label>
                  <span className="text-sm font-medium">≥ {(fatorR.verde * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[fatorR.verde * 100]}
                  onValueChange={([v]) => setFatorR(prev => ({ ...prev, verde: v / 100 }))}
                  min={20}
                  max={50}
                  step={1}
                  className="[&_[role=slider]]:bg-green-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    Amarelo (atenção)
                  </Label>
                  <span className="text-sm font-medium">≥ {(fatorR.amarelo * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[fatorR.amarelo * 100]}
                  onValueChange={([v]) => setFatorR(prev => ({ ...prev, amarelo: v / 100 }))}
                  min={15}
                  max={fatorR.verde * 100 - 1}
                  step={1}
                  className="[&_[role=slider]]:bg-yellow-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    Vermelho (crítico)
                  </Label>
                  <span className="text-sm font-medium">&lt; {(fatorR.vermelho * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[fatorR.vermelho * 100]}
                  onValueChange={([v]) => setFatorR(prev => ({ ...prev, vermelho: v / 100 }))}
                  min={10}
                  max={fatorR.amarelo * 100 - 1}
                  step={1}
                  className="[&_[role=slider]]:bg-red-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Folha Informal Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Folha Informal
              </CardTitle>
              <CardDescription>
                Percentual máximo de pagamentos informais sobre a folha total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folha-alerta">Alerta (amarelo)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="folha-alerta"
                    type="number"
                    min={1}
                    max={50}
                    value={(folhaInformal.alerta * 100).toFixed(0)}
                    onChange={e => setFolhaInformal(prev => ({ 
                      ...prev, 
                      alerta: Number(e.target.value) / 100 
                    }))}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="folha-critico">Crítico (vermelho)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="folha-critico"
                    type="number"
                    min={folhaInformal.alerta * 100 + 1}
                    max={100}
                    value={(folhaInformal.critico * 100).toFixed(0)}
                    onChange={e => setFolhaInformal(prev => ({ 
                      ...prev, 
                      critico: Number(e.target.value) / 100 
                    }))}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diferença de Caixa Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Diferença de Caixa
              </CardTitle>
              <CardDescription>
                Valor tolerável de diferença no fechamento de caixa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="caixa-tolerancia">Tolerância</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">R$</span>
                  <Input
                    id="caixa-tolerancia"
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={caixaDiferenca.valor}
                    onChange={e => setCaixaDiferenca({ valor: Number(e.target.value) })}
                    className="w-32"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Diferenças acima deste valor serão destacadas em vermelho
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Carga Tributária Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Carga Tributária
              </CardTitle>
              <CardDescription>
                Limite máximo de carga tributária sobre a receita
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="tributo-max">Máximo</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tributo-max"
                    type="number"
                    min={1}
                    max={50}
                    value={(cargaTributaria.percentual * 100).toFixed(0)}
                    onChange={e => setCargaTributaria({ 
                      percentual: Number(e.target.value) / 100 
                    })}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cargas acima deste percentual disparam alerta no dashboard
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AlertsConfig;