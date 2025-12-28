import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/access-policy';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle } from 'lucide-react';
import { useAccountingAudit } from '@/hooks/useAccountingAudit';
import { 
  AuditStatusCard, 
  AuditFatorRCard, 
  AuditTaxesCard, 
  AuditRevenueCard, 
  AuditReviewPanel 
} from '@/components/audit';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export default function AccountingAudit() {
  const { role } = useAuth();
  const currentDate = new Date();
  
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // Previous month

  // Fetch units
  type UnitOption = { id: string; name: string };
  const { data: units } = useQuery<UnitOption[]>({
    queryKey: ['units-list'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('units') as any).select('id, name').eq('active', true);
      if (error) throw error;
      return (data ?? []) as UnitOption[];
    },
  });

  // Check access
  const hasAccess = canAccess(role, 'accounting_audit');

  // Fetch audit data
  const { data: auditData, isLoading, error } = useAccountingAudit(
    selectedUnit, 
    selectedYear, 
    selectedMonth
  );

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert variant="destructive" className="max-w-md">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para acessar a Auditoria Contábil.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Kiosque de Auditoria Contábil
            </h1>
            <p className="text-muted-foreground">
              Conferência de dados contábeis por competência
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select 
              value={selectedUnit || 'all'} 
              onValueChange={(v) => setSelectedUnit(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas unidades</SelectItem>
                {units?.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={String(selectedMonth)} 
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={String(selectedYear)} 
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar dados: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {auditData && (
          <div className="space-y-6">
            {/* Row 1: Status + Fator R */}
            <div className="grid gap-6 md:grid-cols-2">
              <AuditStatusCard 
                status={auditData.status} 
                checklist={auditData.checklist} 
              />
              <AuditFatorRCard 
                competenceData={auditData.competenceData} 
                fatorR={auditData.fatorR} 
              />
            </div>

            {/* Row 2: Impostos x OCR */}
            <AuditTaxesCard taxComparisons={auditData.taxComparisons} />

            {/* Row 3: Receitas + Review */}
            <div className="grid gap-6 md:grid-cols-2">
              <AuditRevenueCard revenueComparison={auditData.revenueComparison} />
              <AuditReviewPanel 
                unitId={selectedUnit}
                ano={selectedYear}
                mes={selectedMonth}
                auditLogs={auditData.auditLogs}
              />
            </div>
          </div>
        )}

        {/* No data */}
        {auditData && !auditData.competenceData && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum dado de competência encontrado para {MONTHS.find(m => m.value === selectedMonth)?.label}/{selectedYear}.
              Verifique se os dados foram informados no Painel de Contabilidade.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
