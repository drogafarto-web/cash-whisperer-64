import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================
// CORE PAGES - Fluxo essencial
// ============================================
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";

// Core - Despesas (Contas a Pagar)
import SupplierInvoices from "./pages/payables/SupplierInvoices";
import Boletos from "./pages/payables/Boletos";
import TaxDocuments from "./pages/payables/TaxDocuments";

// Core - Faturamento (Receitas)
import Invoices from "./pages/billing/Invoices";
import Payers from "./pages/billing/Payers";
import BillingSummary from "./pages/billing/Summary";

// Core - Contabilidade
import AccountingPanel from "./pages/AccountingPanel";
import AccountingForm from "./pages/accounting/AccountingForm";
import AccountingBankStatements from "./pages/accounting/AccountingBankStatements";

// Core - Configurações essenciais
import SettingsHub from "./pages/settings/SettingsHub";
import Units from "./pages/settings/Units";
import Accounts from "./pages/settings/Accounts";
import Categories from "./pages/settings/Categories";
import Users from "./pages/settings/Users";
import TaxConfig from "./pages/settings/TaxConfig";

// Sistema
import About from "./pages/About";
import Changelog from "./pages/Changelog";
import NotFound from "./pages/NotFound";

// Módulo Interno (Sem link no menu)
import FiscalControl from "./pages/internal/FiscalControl";

// ============================================
// CORE PAGES - Quiosque
// ============================================
import ReceptionPanel from "./pages/core/ReceptionPanel";

// ============================================
// CORE PAGES - Fechamento de Caixa
// ============================================
import CashClosingSimple from "./pages/CashClosingSimple";

// ============================================
// FUTURE PAGES - Ativar após núcleo estável
// ============================================
import AccountingHistory from "./pages/AccountingHistory";
import AccountingAudit from "./pages/AccountingAudit";
import PayablesDashboard from "./pages/payables/Dashboard";
import BulkManagement from "./pages/payables/BulkManagement";
import Pendencias from "./pages/Pendencias";

// Relatórios
import CashClosingReport from "./pages/reports/CashClosingReport";
import TransactionsReport from "./pages/reports/TransactionsReport";
import CashflowProjection from "./pages/reports/CashflowProjection";
import LisClosuresReport from "./pages/reports/LisClosuresReport";

// Importações
import DailyMovement from "./pages/import/DailyMovement";
import BankStatement from "./pages/import/BankStatement";
import ConvenioReportsImport from "./pages/import/ConvenioReports";

// Conciliação
import PayablesReconciliation from "./pages/payables/Reconciliation";

// ============================================
// ARCHIVED ROUTES
// Ver: src/routes/archived.routes.ts
// ============================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Toaster />
            <Routes>
              {/* ============================================ */}
              {/* CORE ROUTES - Fluxo essencial */}
              {/* ============================================ */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Lançamentos */}
              <Route path="/transactions" element={<Transactions />} />
              
              {/* Despesas (Contas a Pagar) */}
              <Route path="/payables/boletos" element={<Boletos />} />
              <Route path="/payables/supplier-invoices" element={<SupplierInvoices />} />
              <Route path="/payables/tax-documents" element={<TaxDocuments />} />
              
              {/* Faturamento (Receitas) */}
              <Route path="/billing/invoices" element={<Invoices />} />
              <Route path="/billing/payers" element={<Payers />} />
              <Route path="/billing/summary" element={<BillingSummary />} />
              
              {/* Contabilidade */}
              <Route path="/accounting-panel" element={<AccountingPanel />} />
              <Route path="/contabilidade/dados/:token" element={<AccountingForm />} />
              
              {/* Configurações essenciais */}
              <Route path="/settings" element={<SettingsHub />} />
              <Route path="/settings/units" element={<Units />} />
              <Route path="/settings/accounts" element={<Accounts />} />
              <Route path="/settings/categories" element={<Categories />} />
              <Route path="/settings/users" element={<Users />} />
              <Route path="/settings/tax-config" element={<TaxConfig />} />
              
              {/* Sistema */}
              <Route path="/about" element={<About />} />
              <Route path="/changelog" element={<Changelog />} />

              {/* Módulo Interno Protegido (sem link no menu) */}
              <Route path="/settings/internal/fiscal-control" element={<FiscalControl />} />
              
              {/* Contabilidade - Visualização de Extratos (contador) */}
              <Route path="/accounting/bank-statements" element={<AccountingBankStatements />} />

              {/* Portais Simplificados (Modo Quiosque) */}
              <Route path="/portal/atendimento" element={<Navigate to="/reception-panel?mode=kiosk" replace />} />
              <Route path="/portal/contabilidade" element={<Navigate to="/accounting-panel?mode=kiosk" replace />} />

              {/* ============================================ */}
              {/* FUTURE ROUTES - Ativar progressivamente */}
              {/* ============================================ */}
              <Route path="/reception-panel" element={<ReceptionPanel />} />
              <Route path="/accounting-history" element={<AccountingHistory />} />
              <Route path="/accounting-audit" element={<AccountingAudit />} />
              <Route path="/payables/dashboard" element={<PayablesDashboard />} />
              <Route path="/payables/bulk-management" element={<BulkManagement />} />
              <Route path="/payables/reconciliation" element={<PayablesReconciliation />} />
              <Route path="/pendencias" element={<Pendencias />} />
              
              {/* Fechamento de Caixa */}
              <Route path="/cash-closing" element={<CashClosingSimple />} />
              
              {/* Relatórios */}
              <Route path="/reports/cash-closings" element={<CashClosingReport />} />
              <Route path="/reports/transactions" element={<TransactionsReport />} />
              <Route path="/reports/cashflow-projection" element={<CashflowProjection />} />
              <Route path="/reports/lis-closures" element={<LisClosuresReport />} />
              
              {/* Importações */}
              <Route path="/import/daily-movement" element={<DailyMovement />} />
              <Route path="/import/bank-statement" element={<BankStatement />} />
              <Route path="/import/convenio-reports" element={<ConvenioReportsImport />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
