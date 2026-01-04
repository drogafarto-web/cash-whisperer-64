import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Unit, Profile } from '@/types/database';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CalendarIcon,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  ClipboardList,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface EnvelopeWithRelations {
  id: string;
  unit_id: string | null;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  status: string;
  lis_codes_count: number;
  created_at: string;
  created_by: string | null;
  unit?: Unit;
  created_by_profile?: Profile;
}

interface UnitDifferenceData {
  name: string;
  difference: number;
  color: string;
}

export default function CashClosingReport() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [cashClosings, setCashClosings] = useState<EnvelopeWithRelations[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Filters
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [showOnlyWithDifference, setShowOnlyWithDifference] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !isAdmin) {
      navigate('/transactions');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUnits();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchCashClosings();
    }
  }, [user, isAdmin, startDate, endDate, selectedUnitId, showOnlyWithDifference]);

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits(data || []);
  };


  const fetchCashClosings = async () => {
    setIsLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
      let query = supabase
        .from('cash_envelopes')
        .select(`
          id,
          unit_id,
          expected_cash,
          counted_cash,
          difference,
          status,
          lis_codes_count,
          created_at,
          created_by,
          unit:units(*)
        `)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .order('created_at', { ascending: false });

      if (selectedUnitId !== 'all') {
        query = query.eq('unit_id', selectedUnitId);
      }

      if (showOnlyWithDifference) {
        query = query.neq('difference', 0);
      }

      const { data: envelopesData } = await query;

      if (envelopesData && envelopesData.length > 0) {
        // Fetch profiles for created_by
        const createdByIds = [...new Set(envelopesData.map(c => c.created_by).filter(Boolean))];
        const { data: profilesData } = createdByIds.length > 0 
          ? await supabase.from('profiles').select('*').in('id', createdByIds)
          : { data: [] };

        const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

        const enrichedData = envelopesData.map(envelope => ({
          ...envelope,
          created_by_profile: profilesMap.get(envelope.created_by || '') as Profile | undefined,
        }));

        setCashClosings(enrichedData as EnvelopeWithRelations[]);
      } else {
        setCashClosings([]);
      }
    } catch (error) {
      console.error('Error fetching cash envelopes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary stats
  const totalClosings = cashClosings.length;
  const totalExpected = cashClosings.reduce((sum, c) => sum + Number(c.expected_cash || 0), 0);
  const totalActual = cashClosings.reduce((sum, c) => sum + Number(c.counted_cash || 0), 0);
  const totalDifference = cashClosings.reduce((sum, c) => sum + Number(c.difference || 0), 0);
  const totalLisCodes = cashClosings.reduce((sum, c) => sum + Number(c.lis_codes_count || 0), 0);

  // Chart data - differences by unit
  const unitDifferences: UnitDifferenceData[] = units
    .map(unit => {
      const unitClosings = cashClosings.filter(c => c.unit_id === unit.id);
      const difference = unitClosings.reduce((sum, c) => sum + Number(c.difference), 0);
      return {
        name: unit.code || unit.name,
        difference,
        color: difference === 0 ? 'hsl(var(--chart-2))' : difference < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-4))',
      };
    })
    .filter(u => {
      // Only show units that have closings in the period
      return cashClosings.some(c => c.unit?.code === u.name || c.unit?.name === u.name);
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.text('Relatório de Fechamentos de Caixa', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(
      `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
      pageWidth / 2,
      28,
      { align: 'center' }
    );

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo:', 14, 40);
    doc.setFontSize(10);
    doc.text(`Total de Fechamentos: ${totalClosings}`, 14, 48);
    doc.text(`Saldo Esperado: ${formatCurrency(totalExpected)}`, 14, 54);
    doc.text(`Saldo Contado: ${formatCurrency(totalActual)}`, 14, 60);
    doc.text(`Diferença Total: ${formatCurrency(totalDifference)}`, 14, 66);
    doc.text(`Total Códigos LIS: ${totalLisCodes}`, 14, 72);

    // Table
    let yPos = 86;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Data', 14, yPos);
    doc.text('Unidade', 40, yPos);
    doc.text('LIS', 70, yPos);
    doc.text('Esperado', 90, yPos);
    doc.text('Contado', 120, yPos);
    doc.text('Diferença', 150, yPos);
    doc.text('Status', 180, yPos);

    doc.setFont('helvetica', 'normal');
    yPos += 8;

    cashClosings.forEach(envelope => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(format(parseISO(envelope.created_at), 'dd/MM/yyyy'), 14, yPos);
      doc.text(envelope.unit?.code || '—', 40, yPos);
      doc.text(String(envelope.lis_codes_count || 0), 70, yPos);
      doc.text(formatCurrency(Number(envelope.expected_cash || 0)), 90, yPos);
      doc.text(formatCurrency(Number(envelope.counted_cash || 0)), 120, yPos);
      doc.text(formatCurrency(Number(envelope.difference || 0)), 150, yPos);
      doc.text(envelope.status || '—', 180, yPos);
      yPos += 6;
    });

    doc.save(`relatorio-fechamentos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = () => {
    const data = cashClosings.map(envelope => ({
      Data: format(parseISO(envelope.created_at), 'dd/MM/yyyy'),
      Hora: format(parseISO(envelope.created_at), 'HH:mm'),
      Unidade: envelope.unit?.name || '—',
      'Códigos LIS': envelope.lis_codes_count || 0,
      'Saldo Esperado': Number(envelope.expected_cash || 0),
      'Saldo Contado': Number(envelope.counted_cash || 0),
      Diferença: Number(envelope.difference || 0),
      Status: envelope.status || '—',
      'Fechado por': envelope.created_by_profile?.name || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamentos');
    XLSX.writeFile(wb, `relatorio-fechamentos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório de Fechamentos</h1>
            <p className="text-muted-foreground">Acompanhe os fechamentos por unidade e período</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Unit Filter */}
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Only with difference */}
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="difference"
                  checked={showOnlyWithDifference}
                  onCheckedChange={(checked) => setShowOnlyWithDifference(checked as boolean)}
                />
                <Label htmlFor="difference" className="cursor-pointer">
                  Apenas com diferença
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fechamentos</p>
                  <p className="text-2xl font-bold">{totalClosings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Esperado</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalExpected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contado</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-lg",
                  totalDifference === 0 ? "bg-green-500/10" : totalDifference < 0 ? "bg-destructive/10" : "bg-yellow-500/10"
                )}>
                  {totalDifference === 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : totalDifference < 0 ? (
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  ) : (
                    <TrendingUp className="w-6 h-6 text-yellow-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diferença Total</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    totalDifference === 0 ? "text-green-500" : totalDifference < 0 ? "text-destructive" : "text-yellow-500"
                  )}>
                    {formatCurrency(totalDifference)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {unitDifferences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Diferenças por Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitDifferences}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis
                      className="text-xs"
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelClassName="font-medium"
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="difference" name="Diferença" radius={[4, 4, 0, 0]}>
                      {unitDifferences.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Códigos LIS</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fechado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashClosings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum fechamento encontrado no período
                    </TableCell>
                  </TableRow>
                ) : (
                  cashClosings.map(envelope => {
                    const diff = Number(envelope.difference || 0);
                    return (
                      <TableRow key={envelope.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{format(parseISO(envelope.created_at), 'dd/MM/yyyy')}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(envelope.created_at), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{envelope.unit?.code || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{envelope.lis_codes_count || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(envelope.expected_cash || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(envelope.counted_cash || 0))}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          diff === 0 ? "text-green-500" : diff < 0 ? "text-destructive" : "text-yellow-500"
                        )}>
                          <div className="flex items-center justify-end gap-1">
                            {diff === 0 ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            {formatCurrency(diff)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={envelope.status === 'CONFERIDO' ? 'default' : 'outline'}
                            className={cn(
                              envelope.status === 'CONFERIDO' && 'bg-green-500/10 text-green-600 border-green-500/20'
                            )}
                          >
                            {envelope.status || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {envelope.created_by_profile?.name || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
