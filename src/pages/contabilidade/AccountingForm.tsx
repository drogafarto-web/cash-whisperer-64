import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  AlertTriangle, 
  Calculator, 
  DollarSign, 
  Users, 
  Receipt,
  Info,
  Loader2,
  XCircle,
  Mail,
} from 'lucide-react';

const MONTH_NAMES = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

interface TokenData {
  id: string;
  token: string;
  tipo: 'mensal' | 'historico';
  ano?: number;
  mes?: number;
  ano_inicio?: number;
  mes_inicio?: number;
  ano_fim?: number;
  mes_fim?: number;
  expires_at: string;
  used_at?: string;
  contact_id: string;
}

interface MonthData {
  ano: number;
  mes: number;
  label: string;
  // Receita
  receita_servicos: number;
  receita_outras: number;
  // Folha
  salarios: number;
  prolabore: number;
  inss_patronal: number;
  fgts: number;
  decimo_terceiro: number;
  ferias: number;
  // Impostos
  das: number;
  iss_proprio: number;
  iss_retido: number;
  irrf_retido: number;
  outros: number;
}

function generatePeriods(anoInicio: number, mesInicio: number, anoFim: number, mesFim: number): MonthData[] {
  const periods: MonthData[] = [];
  let ano = anoInicio;
  let mes = mesInicio;

  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    periods.push({
      ano,
      mes,
      label: `${MONTH_NAMES[mes]}/${ano}`,
      receita_servicos: 0,
      receita_outras: 0,
      salarios: 0,
      prolabore: 0,
      inss_patronal: 0,
      fgts: 0,
      decimo_terceiro: 0,
      ferias: 0,
      das: 0,
      iss_proprio: 0,
      iss_retido: 0,
      irrf_retido: 0,
      outros: 0,
    });

    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }

  return periods;
}

export default function AccountingForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Token não fornecido');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('accounting_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (fetchError || !data) {
          setError('Token inválido ou não encontrado');
          setLoading(false);
          return;
        }

        // Check expiration
        if (new Date(data.expires_at) < new Date()) {
          setError('Este link expirou. Solicite um novo link à empresa.');
          setLoading(false);
          return;
        }

        // Check if already used (for mensal type)
        if (data.tipo === 'mensal' && data.used_at) {
          setError('Este link já foi utilizado. Os dados já foram enviados.');
          setLoading(false);
          return;
        }

        setTokenData(data as TokenData);

        // Generate periods based on token type
        let periods: MonthData[];
        if (data.tipo === 'mensal' && data.ano && data.mes) {
          periods = [{
            ano: data.ano,
            mes: data.mes,
            label: `${MONTH_NAMES[data.mes]}/${data.ano}`,
            receita_servicos: 0,
            receita_outras: 0,
            salarios: 0,
            prolabore: 0,
            inss_patronal: 0,
            fgts: 0,
            decimo_terceiro: 0,
            ferias: 0,
            das: 0,
            iss_proprio: 0,
            iss_retido: 0,
            irrf_retido: 0,
            outros: 0,
          }];
        } else {
          periods = generatePeriods(
            data.ano_inicio || 2024,
            data.mes_inicio || 11,
            data.ano_fim || 2025,
            data.mes_fim || 12
          );
        }

        setMonths(periods);
        setLoading(false);
      } catch (err) {
        console.error('Token validation error:', err);
        setError('Erro ao validar o link. Tente novamente.');
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // Calculate totals
  const totals = useMemo(() => {
    const folha = months.reduce((sum, m) => 
      sum + m.salarios + m.prolabore + m.inss_patronal + m.fgts + m.decimo_terceiro + m.ferias, 0);
    const receita = months.reduce((sum, m) => sum + m.receita_servicos + m.receita_outras, 0);
    const impostos = months.reduce((sum, m) => 
      sum + m.das + m.iss_proprio + m.iss_retido + m.irrf_retido + m.outros, 0);
    const fatorR = receita > 0 ? (folha / receita) * 100 : 0;

    return { folha, receita, impostos, fatorR };
  }, [months]);

  // Update month data
  const updateMonth = (index: number, field: keyof MonthData, value: number) => {
    setMonths(prev => prev.map((m, i) => 
      i === index ? { ...m, [field]: value } : m
    ));
  };

  // Submit data
  const handleSubmit = async () => {
    // Validate required fields
    const hasRequiredData = months.every(m => m.receita_servicos >= 0);
    if (!hasRequiredData) {
      toast.error('Preencha a receita de serviços para todos os meses');
      return;
    }

    setSubmitting(true);

    try {
      const response = await supabase.functions.invoke('save-accounting-data', {
        body: {
          token,
          data: months.map(m => ({
            ano: m.ano,
            mes: m.mes,
            receita_servicos: m.receita_servicos,
            receita_outras: m.receita_outras,
            salarios: m.salarios,
            prolabore: m.prolabore,
            inss_patronal: m.inss_patronal,
            fgts: m.fgts,
            decimo_terceiro: m.decimo_terceiro,
            ferias: m.ferias,
            das: m.das,
            iss_proprio: m.iss_proprio,
            iss_retido: m.iss_retido,
            irrf_retido: m.irrf_retido,
            outros: m.outros,
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSuccess(true);
      toast.success('Dados enviados com sucesso!');
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error(err.message || 'Erro ao enviar dados');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validando acesso...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">{error}</p>
            
            <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2">
              <p className="text-sm font-medium">Precisa de ajuda?</p>
              <p className="text-sm text-muted-foreground">
                Entre em contato com a empresa para solicitar um novo link de acesso.
              </p>
            </div>

            <div className="pt-4 space-y-2">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => {
                  const subject = encodeURIComponent('Solicitação de novo link - Portal Contabilidade');
                  const body = encodeURIComponent(`Olá,\n\nO link de acesso ao Portal da Contabilidade expirou ou está inválido.\n\nErro: ${error}\n\nPor favor, envie um novo link.\n\nObrigado!`);
                  window.location.href = `mailto:?subject=${subject}&body=${body}`;
                }}
              >
                <Mail className="h-4 w-4" />
                Solicitar Novo Link por Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Dados Enviados!</h2>
            <p className="text-muted-foreground mb-4">
              Os dados foram salvos com sucesso. O sistema atualizará automaticamente 
              os relatórios e cenários tributários.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm">
                <strong>Resumo:</strong><br />
                Receita Total: {formatCurrency(totals.receita)}<br />
                Folha Total: {formatCurrency(totals.folha)}<br />
                Fator R: {totals.fatorR.toFixed(2)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHistorico = tokenData?.tipo === 'historico';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-violet-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Calculator className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Labclin Finance</h1>
              <p className="text-white/80">Portal da Contabilidade</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Instructions */}
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Use os relatórios padrão da sua folha e apuração de impostos para preencher os valores consolidados.
            Não é necessário enviar planilhas — basta informar os totais.
          </AlertDescription>
        </Alert>

        {/* Period Badge */}
        <div className="mb-6">
          <Badge variant="outline" className="text-lg px-4 py-2">
            {isHistorico 
              ? `Período: ${MONTH_NAMES[tokenData?.mes_inicio || 11]}/${tokenData?.ano_inicio || 2024} a ${MONTH_NAMES[tokenData?.mes_fim || 12]}/${tokenData?.ano_fim || 2025}` 
              : `Período: ${months[0]?.label}`
            }
          </Badge>
        </div>

        {/* Form */}
        {isHistorico ? (
          // Historical view - tabs with table
          <Tabs defaultValue="receita" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="receita" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Receita
              </TabsTrigger>
              <TabsTrigger value="folha" className="gap-2">
                <Users className="h-4 w-4" />
                Folha
              </TabsTrigger>
              <TabsTrigger value="impostos" className="gap-2">
                <Receipt className="h-4 w-4" />
                Impostos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receita">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    Receita do Laboratório
                  </CardTitle>
                  <CardDescription>Faturamento mensal de serviços e outras receitas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Mês</TableHead>
                          <TableHead>Receita de Serviços (R$) *</TableHead>
                          <TableHead>Outras Receitas (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((month, index) => (
                          <TableRow key={`${month.ano}-${month.mes}`}>
                            <TableCell className="font-medium">{month.label}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.receita_servicos || ''}
                                onChange={(e) => updateMonth(index, 'receita_servicos', parseFloat(e.target.value) || 0)}
                                placeholder="0,00"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.receita_outras || ''}
                                onChange={(e) => updateMonth(index, 'receita_outras', parseFloat(e.target.value) || 0)}
                                placeholder="0,00"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="folha">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Folha de Pagamento
                  </CardTitle>
                  <CardDescription>Salários, pró-labore e encargos trabalhistas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Mês</TableHead>
                          <TableHead>Salários</TableHead>
                          <TableHead>Pró-labore</TableHead>
                          <TableHead>INSS/CPP</TableHead>
                          <TableHead>FGTS</TableHead>
                          <TableHead>13º</TableHead>
                          <TableHead>Férias</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((month, index) => (
                          <TableRow key={`${month.ano}-${month.mes}`}>
                            <TableCell className="font-medium">{month.label}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.salarios || ''}
                                onChange={(e) => updateMonth(index, 'salarios', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.prolabore || ''}
                                onChange={(e) => updateMonth(index, 'prolabore', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.inss_patronal || ''}
                                onChange={(e) => updateMonth(index, 'inss_patronal', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.fgts || ''}
                                onChange={(e) => updateMonth(index, 'fgts', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.decimo_terceiro || ''}
                                onChange={(e) => updateMonth(index, 'decimo_terceiro', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.ferias || ''}
                                onChange={(e) => updateMonth(index, 'ferias', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impostos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-amber-500" />
                    Impostos
                  </CardTitle>
                  <CardDescription>Tributos pagos e retidos mensalmente</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Mês</TableHead>
                          <TableHead>DAS</TableHead>
                          <TableHead>ISS Próprio</TableHead>
                          <TableHead>ISS Retido</TableHead>
                          <TableHead>IRRF Retido</TableHead>
                          <TableHead>Outros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((month, index) => (
                          <TableRow key={`${month.ano}-${month.mes}`}>
                            <TableCell className="font-medium">{month.label}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.das || ''}
                                onChange={(e) => updateMonth(index, 'das', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.iss_proprio || ''}
                                onChange={(e) => updateMonth(index, 'iss_proprio', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.iss_retido || ''}
                                onChange={(e) => updateMonth(index, 'iss_retido', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.irrf_retido || ''}
                                onChange={(e) => updateMonth(index, 'irrf_retido', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={month.outros || ''}
                                onChange={(e) => updateMonth(index, 'outros', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="w-24"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          // Monthly view - single form
          <div className="grid gap-6">
            {/* Receita */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  Receita do Laboratório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="receita_servicos">Receita de Serviços (R$) *</Label>
                    <Input
                      id="receita_servicos"
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.receita_servicos || ''}
                      onChange={(e) => updateMonth(0, 'receita_servicos', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="receita_outras">Outras Receitas (R$)</Label>
                    <Input
                      id="receita_outras"
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.receita_outras || ''}
                      onChange={(e) => updateMonth(0, 'receita_outras', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Folha */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Folha de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>Salários Brutos (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.salarios || ''}
                      onChange={(e) => updateMonth(0, 'salarios', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Pró-labore (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.prolabore || ''}
                      onChange={(e) => updateMonth(0, 'prolabore', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>INSS Patronal / CPP (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.inss_patronal || ''}
                      onChange={(e) => updateMonth(0, 'inss_patronal', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>FGTS (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.fgts || ''}
                      onChange={(e) => updateMonth(0, 'fgts', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>13º Salário (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.decimo_terceiro || ''}
                      onChange={(e) => updateMonth(0, 'decimo_terceiro', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Férias (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.ferias || ''}
                      onChange={(e) => updateMonth(0, 'ferias', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Impostos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-amber-500" />
                  Impostos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>DAS - Simples Nacional (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.das || ''}
                      onChange={(e) => updateMonth(0, 'das', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>ISS Próprio (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.iss_proprio || ''}
                      onChange={(e) => updateMonth(0, 'iss_proprio', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>ISS Retido (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.iss_retido || ''}
                      onChange={(e) => updateMonth(0, 'iss_retido', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>IRRF Retido (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.irrf_retido || ''}
                      onChange={(e) => updateMonth(0, 'irrf_retido', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Outros Tributos (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={months[0]?.outros || ''}
                      onChange={(e) => updateMonth(0, 'outros', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary */}
        <Card className="mt-6 bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resumo antes de enviar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">Total Receita</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.receita)}</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">Total Folha</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.folha)}</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">Total Impostos</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.impostos)}</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">Fator R</p>
                <p className={`text-xl font-bold ${totals.fatorR >= 28 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.fatorR.toFixed(2)}%
                </p>
                <Badge variant={totals.fatorR >= 28 ? 'default' : 'destructive'} className="mt-1">
                  {totals.fatorR >= 28 ? 'Anexo III' : 'Anexo V'}
                </Badge>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Button 
                size="lg" 
                onClick={handleSubmit} 
                disabled={submitting}
                className="gap-2 min-w-[200px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Enviar Dados
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
