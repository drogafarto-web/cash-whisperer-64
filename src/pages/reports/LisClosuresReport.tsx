import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { notifySuccess, notifyError } from '@/lib/notify';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  FileDown, 
  FileText, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Banknote,
  Calculator
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface LisClosure {
  id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_dinheiro: number;
  total_pix: number;
  total_cartao_liquido: number;
  total_taxa_cartao: number;
  total_nao_pago: number;
  itens_sem_comprovante: number;
  created_by: string;
  created_at: string;
  closed_by: string | null;
  closed_at: string | null;
  units?: { name: string; code: string };
  created_profile?: { name: string };
  closed_profile?: { name: string };
}

interface Profile {
  id: string;
  name: string;
}

export default function LisClosuresReport() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  

  const [units, setUnits] = useState<Unit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [closures, setClosures] = useState<LisClosure[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [periodStart, setPeriodStart] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [authLoading, user, navigate]);

  const fetchData = async () => {
    try {
      const [unitsRes, profilesRes] = await Promise.all([
        supabase.from('units').select('id, name, code').order('name'),
        supabase.from('profiles').select('id, name'),
      ]);

      if (unitsRes.data) setUnits(unitsRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClosures = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('lis_closures')
        .select(`
          *,
          units:unit_id(name, code)
        `)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('period_start', { ascending: false });

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map profile names
      const closuresWithProfiles = (data || []).map(closure => ({
        ...closure,
        created_profile: profiles.find(p => p.id === closure.created_by),
        closed_profile: closure.closed_by ? profiles.find(p => p.id === closure.closed_by) : null,
      }));

      setClosures(closuresWithProfiles);
    } catch (error) {
      console.error('Erro ao buscar fechamentos:', error);
      notifyError('Erro', 'Erro ao buscar fechamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profiles.length > 0) {
      fetchClosures();
    }
  }, [selectedUnitId, selectedStatus, periodStart, periodEnd, profiles]);

  // Summary calculations
  const summary = useMemo(() => {
    return {
      total: closures.length,
      fechados: closures.filter(c => c.status === 'FECHADO').length,
      abertos: closures.filter(c => c.status === 'ABERTO').length,
      totalDinheiro: closures.reduce((sum, c) => sum + (c.total_dinheiro || 0), 0),
      totalPix: closures.reduce((sum, c) => sum + (c.total_pix || 0), 0),
      totalCartao: closures.reduce((sum, c) => sum + (c.total_cartao_liquido || 0), 0),
      totalTaxa: closures.reduce((sum, c) => sum + (c.total_taxa_cartao || 0), 0),
      totalNaoPago: closures.reduce((sum, c) => sum + (c.total_nao_pago || 0), 0),
    };
  }, [closures]);

  // Chart data by unit
  const chartData = useMemo(() => {
    const byUnit: Record<string, { name: string; dinheiro: number; pix: number; cartao: number }> = {};
    
    closures.forEach(closure => {
      const unitName = closure.units?.name || 'Sem unidade';
      if (!byUnit[unitName]) {
        byUnit[unitName] = { name: unitName, dinheiro: 0, pix: 0, cartao: 0 };
      }
      byUnit[unitName].dinheiro += closure.total_dinheiro || 0;
      byUnit[unitName].pix += closure.total_pix || 0;
      byUnit[unitName].cartao += closure.total_cartao_liquido || 0;
    });

    return Object.values(byUnit);
  }, [closures]);

  // Export to PDF
  const handleExportPdf = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Fechamentos LIS', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Período: ${format(new Date(periodStart), 'dd/MM/yyyy')} a ${format(new Date(periodEnd), 'dd/MM/yyyy')}`, 14, 32);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 38);

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total de Fechamentos: ${summary.total}`, 14, 58);
    doc.text(`Fechados: ${summary.fechados} | Abertos: ${summary.abertos}`, 14, 64);
    doc.text(`Dinheiro: R$ ${summary.totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 72);
    doc.text(`Pix: R$ ${summary.totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 78);
    doc.text(`Cartão (líq.): R$ ${summary.totalCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 84);

    // Table
    let y = 100;
    doc.setFontSize(10);
    doc.text('Período', 14, y);
    doc.text('Unidade', 50, y);
    doc.text('Status', 90, y);
    doc.text('Dinheiro', 120, y);
    doc.text('Pix', 150, y);
    doc.text('Cartão', 175, y);

    y += 6;
    doc.line(14, y, 196, y);
    y += 4;

    closures.slice(0, 25).forEach(closure => {
      doc.text(`${format(new Date(closure.period_start), 'dd/MM')} - ${format(new Date(closure.period_end), 'dd/MM')}`, 14, y);
      doc.text(closure.units?.name?.substring(0, 15) || '-', 50, y);
      doc.text(closure.status, 90, y);
      doc.text(`R$ ${(closure.total_dinheiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 120, y);
      doc.text(`R$ ${(closure.total_pix || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, y);
      doc.text(`R$ ${(closure.total_cartao_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 175, y);
      y += 6;
      
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`fechamentos-lis-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    notifySuccess('PDF gerado', 'Arquivo baixado com sucesso');
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = closures.map(closure => ({
      'Período Início': format(new Date(closure.period_start), 'dd/MM/yyyy'),
      'Período Fim': format(new Date(closure.period_end), 'dd/MM/yyyy'),
      'Unidade': closure.units?.name || '-',
      'Status': closure.status,
      'Dinheiro': closure.total_dinheiro || 0,
      'Pix': closure.total_pix || 0,
      'Cartão (líq.)': closure.total_cartao_liquido || 0,
      'Taxa Cartão': closure.total_taxa_cartao || 0,
      'Não Pagos': closure.total_nao_pago || 0,
      'Itens s/ Comprv.': closure.itens_sem_comprovante || 0,
      'Criado por': closure.created_profile?.name || '-',
      'Criado em': format(new Date(closure.created_at), 'dd/MM/yyyy HH:mm'),
      'Fechado por': closure.closed_profile?.name || '-',
      'Fechado em': closure.closed_at ? format(new Date(closure.closed_at), 'dd/MM/yyyy HH:mm') : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamentos LIS');
    XLSX.writeFile(wb, `fechamentos-lis-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    notifySuccess('Excel gerado', 'Arquivo baixado com sucesso');
  };

  if (loading && units.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatório de Fechamentos LIS</h1>
            <p className="text-muted-foreground">Análise de fechamentos por período, unidade e status</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              <FileText className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="periodStart">Data Inicial</Label>
                <Input 
                  type="date" 
                  value={periodStart} 
                  onChange={e => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="periodEnd">Data Final</Label>
                <Input 
                  type="date" 
                  value={periodEnd} 
                  onChange={e => setPeriodEnd(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="unit">Unidade</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="FECHADO">Fechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summary.total}</p>
              <p className="text-xs text-muted-foreground">
                {summary.fechados} fechados, {summary.abertos} abertos
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">Dinheiro</span>
              </div>
              <p className="text-xl font-bold text-green-700 mt-1">
                R$ {summary.totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Pix</span>
              </div>
              <p className="text-xl font-bold text-purple-700 mt-1">
                R$ {summary.totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Cartão</span>
              </div>
              <p className="text-xl font-bold text-blue-700 mt-1">
                R$ {summary.totalCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Taxa Cartão</span>
              </div>
              <p className="text-xl font-bold text-orange-700 mt-1">
                R$ {summary.totalTaxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Totais por Unidade</CardTitle>
              <CardDescription>Comparativo de valores por forma de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    <Bar dataKey="dinheiro" name="Dinheiro" fill="#16a34a" />
                    <Bar dataKey="pix" name="Pix" fill="#9333ea" />
                    <Bar dataKey="cartao" name="Cartão" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fechamentos ({closures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dinheiro</TableHead>
                    <TableHead className="text-right">Pix</TableHead>
                    <TableHead className="text-right">Cartão</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead>Fechado por</TableHead>
                    <TableHead>Data Fech.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map(closure => (
                    <TableRow key={closure.id}>
                      <TableCell className="text-sm">
                        {format(new Date(closure.period_start), 'dd/MM')} - {format(new Date(closure.period_end), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {closure.units?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={closure.status === 'FECHADO' ? 'default' : 'secondary'}>
                          {closure.status === 'FECHADO' ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Fechado</>
                          ) : (
                            <><AlertTriangle className="h-3 w-3 mr-1" /> Aberto</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-700">
                        R$ {(closure.total_dinheiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-purple-700">
                        R$ {(closure.total_pix || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-blue-700">
                        R$ {(closure.total_cartao_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-sm text-orange-700">
                        R$ {(closure.total_taxa_cartao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {closure.closed_profile?.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {closure.closed_at 
                          ? format(new Date(closure.closed_at), 'dd/MM HH:mm')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {closures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum fechamento encontrado para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
