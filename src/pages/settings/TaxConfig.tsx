import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Building2, FileText, Calculator, MapPin, Landmark, Calendar } from 'lucide-react';
import { Unit, UnitType, RegimeTributario, IssTipoApuracao } from '@/types/database';
import { useTaxConfig, useSaveTaxConfig, UnitFiscalData } from '@/hooks/useTaxConfig';

interface SimplesNacionalFaixa {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquota: number;
  deducao: number;
}

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  'MATRIZ': 'Matriz',
  'FILIAL_COM_NF': 'Filial com NF',
  'POSTO_COLETA_SEM_NF': 'Posto de Coleta (sem NF)',
};

const REGIME_LABELS: Record<RegimeTributario, string> = {
  'SIMPLES_NACIONAL': 'Simples Nacional',
  'LUCRO_PRESUMIDO': 'Lucro Presumido',
  'LUCRO_REAL': 'Lucro Real',
};

export default function TaxConfig() {
  const queryClient = useQueryClient();
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [unitConfig, setUnitConfig] = useState({
    cnpj: '',
    regime_atual: 'SIMPLES',
    iss_aliquota: 0.05,
    notas: '',
  });

  // Estados para parâmetros gerais
  const [taxParams, setTaxParams] = useState({
    presuncao_servicos: 0.32,
    pis_cumulativo: 0.0065,
    pis_nao_cumulativo: 0.0165,
    cofins_cumulativo: 0.03,
    cofins_nao_cumulativo: 0.076,
    irpj_aliquota: 0.15,
    irpj_adicional: 0.10,
    irpj_adicional_limite: 20000,
    csll_aliquota: 0.09,
    cbs_aliquota: 0.088,
    ibs_aliquota: 0.175,
    reducao_saude: 0.60,
  });

  // Estados para Simples Nacional
  const [anexo3Faixas, setAnexo3Faixas] = useState<SimplesNacionalFaixa[]>([]);
  const [anexo5Faixas, setAnexo5Faixas] = useState<SimplesNacionalFaixa[]>([]);

  // Buscar unidades
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('units').select('*').order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Buscar configuração da unidade selecionada
  const { data: unitTaxConfig, refetch: refetchUnitConfig } = useQuery({
    queryKey: ['tax-config', selectedUnitId],
    queryFn: async () => {
      if (!selectedUnitId) return null;
      const { data, error } = await supabase
        .from('tax_config')
        .select('*')
        .eq('unit_id', selectedUnitId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUnitId,
  });

  // Buscar parâmetros tributários
  const { data: taxParameters, refetch: refetchTaxParams } = useQuery({
    queryKey: ['tax-parameters-2025'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_parameters')
        .select('*')
        .eq('ano', 2025)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Atualizar estados quando dados carregarem
  useEffect(() => {
    if (unitTaxConfig) {
      setUnitConfig({
        cnpj: unitTaxConfig.cnpj || '',
        regime_atual: unitTaxConfig.regime_atual,
        iss_aliquota: Number(unitTaxConfig.iss_aliquota),
        notas: unitTaxConfig.notas || '',
      });
    } else if (selectedUnitId) {
      setUnitConfig({
        cnpj: '',
        regime_atual: 'SIMPLES',
        iss_aliquota: 0.05,
        notas: '',
      });
    }
  }, [unitTaxConfig, selectedUnitId]);

  useEffect(() => {
    if (taxParameters) {
      setTaxParams({
        presuncao_servicos: Number(taxParameters.presuncao_servicos),
        pis_cumulativo: Number(taxParameters.pis_cumulativo),
        pis_nao_cumulativo: Number(taxParameters.pis_nao_cumulativo),
        cofins_cumulativo: Number(taxParameters.cofins_cumulativo),
        cofins_nao_cumulativo: Number(taxParameters.cofins_nao_cumulativo),
        irpj_aliquota: Number(taxParameters.irpj_aliquota),
        irpj_adicional: Number(taxParameters.irpj_adicional),
        irpj_adicional_limite: Number(taxParameters.irpj_adicional_limite),
        csll_aliquota: Number(taxParameters.csll_aliquota),
        cbs_aliquota: Number(taxParameters.cbs_aliquota),
        ibs_aliquota: Number(taxParameters.ibs_aliquota),
        reducao_saude: Number(taxParameters.reducao_saude),
      });
      setAnexo3Faixas(taxParameters.simples_anexo3_faixas as unknown as SimplesNacionalFaixa[]);
      setAnexo5Faixas(taxParameters.simples_anexo5_faixas as unknown as SimplesNacionalFaixa[]);
    }
  }, [taxParameters]);

  // Mutation para salvar configuração da unidade
  const saveUnitConfigMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUnitId) throw new Error('Selecione uma unidade');
      
      const configData = {
        unit_id: selectedUnitId,
        cnpj: unitConfig.cnpj || null,
        regime_atual: unitConfig.regime_atual,
        iss_aliquota: unitConfig.iss_aliquota,
        notas: unitConfig.notas || null,
      };

      if (unitTaxConfig) {
        const { error } = await supabase
          .from('tax_config')
          .update(configData)
          .eq('id', unitTaxConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tax_config')
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuração da unidade salva!');
      refetchUnitConfig();
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Mutation para salvar parâmetros gerais
  const saveTaxParamsMutation = useMutation({
    mutationFn: async () => {
      if (!taxParameters?.id) throw new Error('Parâmetros não encontrados');
      
      const { error } = await supabase
        .from('tax_parameters')
        .update({
          presuncao_servicos: taxParams.presuncao_servicos,
          pis_cumulativo: taxParams.pis_cumulativo,
          pis_nao_cumulativo: taxParams.pis_nao_cumulativo,
          cofins_cumulativo: taxParams.cofins_cumulativo,
          cofins_nao_cumulativo: taxParams.cofins_nao_cumulativo,
          irpj_aliquota: taxParams.irpj_aliquota,
          irpj_adicional: taxParams.irpj_adicional,
          irpj_adicional_limite: taxParams.irpj_adicional_limite,
          csll_aliquota: taxParams.csll_aliquota,
          cbs_aliquota: taxParams.cbs_aliquota,
          ibs_aliquota: taxParams.ibs_aliquota,
          reducao_saude: taxParams.reducao_saude,
          simples_anexo3_faixas: anexo3Faixas as unknown as import('@/integrations/supabase/types').Json,
          simples_anexo5_faixas: anexo5Faixas as unknown as import('@/integrations/supabase/types').Json,
        })
        .eq('id', taxParameters.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Parâmetros tributários salvos!');
      refetchTaxParams();
      queryClient.invalidateQueries({ queryKey: ['tax-parameters'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const updateFaixa = (
    anexo: 'anexo3' | 'anexo5',
    index: number,
    field: keyof SimplesNacionalFaixa,
    value: number
  ) => {
    const setter = anexo === 'anexo3' ? setAnexo3Faixas : setAnexo5Faixas;
    const faixas = anexo === 'anexo3' ? anexo3Faixas : anexo5Faixas;
    
    const updated = [...faixas];
    updated[index] = { ...updated[index], [field]: value };
    setter(updated);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuração Tributária
          </h1>
          <p className="text-muted-foreground">
            Gerencie parâmetros fiscais e alíquotas para simulações precisas
          </p>
        </div>

        <Tabs defaultValue="unit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="unit" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Por Unidade</span>
            </TabsTrigger>
            <TabsTrigger value="params" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Parâmetros</span>
            </TabsTrigger>
            <TabsTrigger value="simples" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Simples</span>
            </TabsTrigger>
            <TabsTrigger value="reforma" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Reforma</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Configuração por Unidade */}
          <TabsContent value="unit">
            <Card>
              <CardHeader>
                <CardTitle>Configuração por Unidade</CardTitle>
                <CardDescription>
                  Defina CNPJ, regime tributário atual e alíquota de ISS para cada unidade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Selecione a Unidade</Label>
                  <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Escolha uma unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedUnitId && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>CNPJ</Label>
                        <Input
                          placeholder="00.000.000/0000-00"
                          value={unitConfig.cnpj}
                          onChange={(e) => setUnitConfig({ ...unitConfig, cnpj: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Regime Tributário Atual</Label>
                        <Select
                          value={unitConfig.regime_atual}
                          onValueChange={(v) => setUnitConfig({ ...unitConfig, regime_atual: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                            <SelectItem value="PRESUMIDO">Lucro Presumido</SelectItem>
                            <SelectItem value="REAL">Lucro Real</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Alíquota ISS (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={(unitConfig.iss_aliquota * 100).toFixed(1)}
                          onChange={(e) =>
                            setUnitConfig({
                              ...unitConfig,
                              iss_aliquota: parseFloat(e.target.value) / 100,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        placeholder="Notas sobre a configuração tributária desta unidade..."
                        value={unitConfig.notas}
                        onChange={(e) => setUnitConfig({ ...unitConfig, notas: e.target.value })}
                      />
                    </div>
                    <Button
                      onClick={() => saveUnitConfigMutation.mutate()}
                      disabled={saveUnitConfigMutation.isPending}
                    >
                      {saveUnitConfigMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Parâmetros Gerais */}
          <TabsContent value="params">
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros de Lucro Presumido / Real</CardTitle>
                <CardDescription>
                  Alíquotas de IRPJ, CSLL, PIS e COFINS para simulações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Base Presunção Serviços (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={(taxParams.presuncao_servicos * 100).toFixed(0)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, presuncao_servicos: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                  <div>
                    <Label>IRPJ Alíquota (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(taxParams.irpj_aliquota * 100).toFixed(1)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, irpj_aliquota: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                  <div>
                    <Label>IRPJ Adicional (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(taxParams.irpj_adicional * 100).toFixed(1)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, irpj_adicional: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                  <div>
                    <Label>IRPJ Adicional Limite (R$)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={taxParams.irpj_adicional_limite}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, irpj_adicional_limite: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>CSLL Alíquota (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(taxParams.csll_aliquota * 100).toFixed(1)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, csll_aliquota: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">PIS/COFINS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>PIS Cumulativo (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(taxParams.pis_cumulativo * 100).toFixed(2)}
                        onChange={(e) =>
                          setTaxParams({ ...taxParams, pis_cumulativo: parseFloat(e.target.value) / 100 })
                        }
                      />
                    </div>
                    <div>
                      <Label>COFINS Cumulativo (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(taxParams.cofins_cumulativo * 100).toFixed(2)}
                        onChange={(e) =>
                          setTaxParams({ ...taxParams, cofins_cumulativo: parseFloat(e.target.value) / 100 })
                        }
                      />
                    </div>
                    <div>
                      <Label>PIS Não-Cumulativo (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(taxParams.pis_nao_cumulativo * 100).toFixed(2)}
                        onChange={(e) =>
                          setTaxParams({ ...taxParams, pis_nao_cumulativo: parseFloat(e.target.value) / 100 })
                        }
                      />
                    </div>
                    <div>
                      <Label>COFINS Não-Cumulativo (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(taxParams.cofins_nao_cumulativo * 100).toFixed(2)}
                        onChange={(e) =>
                          setTaxParams({ ...taxParams, cofins_nao_cumulativo: parseFloat(e.target.value) / 100 })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => saveTaxParamsMutation.mutate()}
                  disabled={saveTaxParamsMutation.isPending}
                >
                  {saveTaxParamsMutation.isPending ? 'Salvando...' : 'Salvar Parâmetros'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Simples Nacional */}
          <TabsContent value="simples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Simples Nacional - Anexo III (2025)</CardTitle>
                <CardDescription>
                  Faixas para empresas com Fator R ≥ 28%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Limite Inferior</TableHead>
                      <TableHead>Limite Superior</TableHead>
                      <TableHead>Alíquota (%)</TableHead>
                      <TableHead>Dedução (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anexo3Faixas.map((faixa, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{faixa.faixa}</TableCell>
                        <TableCell>{formatCurrency(faixa.limiteInferior)}</TableCell>
                        <TableCell>{formatCurrency(faixa.limiteSuperior)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            className="w-20"
                            value={(faixa.aliquota * 100).toFixed(1)}
                            onChange={(e) =>
                              updateFaixa('anexo3', idx, 'aliquota', parseFloat(e.target.value) / 100)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="100"
                            className="w-28"
                            value={faixa.deducao}
                            onChange={(e) =>
                              updateFaixa('anexo3', idx, 'deducao', parseFloat(e.target.value))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simples Nacional - Anexo V (2025)</CardTitle>
                <CardDescription>
                  Faixas para empresas com Fator R {'<'} 28%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>Limite Inferior</TableHead>
                      <TableHead>Limite Superior</TableHead>
                      <TableHead>Alíquota (%)</TableHead>
                      <TableHead>Dedução (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anexo5Faixas.map((faixa, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{faixa.faixa}</TableCell>
                        <TableCell>{formatCurrency(faixa.limiteInferior)}</TableCell>
                        <TableCell>{formatCurrency(faixa.limiteSuperior)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            className="w-20"
                            value={(faixa.aliquota * 100).toFixed(1)}
                            onChange={(e) =>
                              updateFaixa('anexo5', idx, 'aliquota', parseFloat(e.target.value) / 100)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="100"
                            className="w-28"
                            value={faixa.deducao}
                            onChange={(e) =>
                              updateFaixa('anexo5', idx, 'deducao', parseFloat(e.target.value))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Button
              onClick={() => saveTaxParamsMutation.mutate()}
              disabled={saveTaxParamsMutation.isPending}
            >
              {saveTaxParamsMutation.isPending ? 'Salvando...' : 'Salvar Faixas do Simples'}
            </Button>
          </TabsContent>

          {/* Tab: Reforma Tributária */}
          <TabsContent value="reforma">
            <Card>
              <CardHeader>
                <CardTitle>Reforma Tributária (CBS/IBS)</CardTitle>
                <CardDescription>
                  Parâmetros estimados para 2027+ (sujeitos a alterações)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>CBS Federal (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(taxParams.cbs_aliquota * 100).toFixed(1)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, cbs_aliquota: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                  <div>
                    <Label>IBS Estadual/Municipal (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(taxParams.ibs_aliquota * 100).toFixed(1)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, ibs_aliquota: parseFloat(e.target.value) / 100 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Redução Saúde (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={(taxParams.reducao_saude * 100).toFixed(0)}
                      onChange={(e) =>
                        setTaxParams({ ...taxParams, reducao_saude: parseFloat(e.target.value) / 100 })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Redução aplicada a serviços de saúde
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm">
                    <strong>Alíquota efetiva para laboratórios:</strong>{' '}
                    {(
                      (taxParams.cbs_aliquota + taxParams.ibs_aliquota) *
                      (1 - taxParams.reducao_saude) *
                      100
                    ).toFixed(2)}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CBS {(taxParams.cbs_aliquota * (1 - taxParams.reducao_saude) * 100).toFixed(2)}% + 
                    IBS {(taxParams.ibs_aliquota * (1 - taxParams.reducao_saude) * 100).toFixed(2)}%
                  </p>
                </div>

                <Button
                  onClick={() => saveTaxParamsMutation.mutate()}
                  disabled={saveTaxParamsMutation.isPending}
                >
                  {saveTaxParamsMutation.isPending ? 'Salvando...' : 'Salvar Parâmetros CBS/IBS'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
