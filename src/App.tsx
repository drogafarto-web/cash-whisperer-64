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
import AccountingForm from "./pages/contabilidade/AccountingForm";

// Core - Configurações essenciais
import SettingsHub from "./pages/settings/SettingsHub";
import Units from "./pages/settings/Units";
import Accounts from "./pages/settings/Accounts";
import Categories from "./pages/settings/Categories";
import Users from "./pages/settings/Users";

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
// ARCHIVED PAGES - Comentadas, não deletadas
// ============================================
// Fechamentos de caixa (múltiplas variações)
// import CashClosing from "./pages/CashClosing";
// import CashClosingSimple from "./pages/CashClosingSimple";
// import LisFechamento from "./pages/lis/LisFechamento";
// import CashClosingWithSelection from "./pages/lis/CashClosingWithSelection";
// import EnvelopeCashClosing from "./pages/EnvelopeCashClosing";
// import PixClosing from "./pages/PixClosing";
// import CardClosing from "./pages/CardClosing";
// import CashHub from "./pages/CashHub";

// Auditorias avançadas
// import ParticularVsCash from "./pages/audit/ParticularVsCash";
// import ConvenioVsInvoice from "./pages/audit/ConvenioVsInvoice";
// import ExtratoParticulares from "./pages/import/ExtratoParticulares";

// Relatórios avançados
// import TaxScenarios from "./pages/reports/TaxScenarios";
// import PersonnelRealVsOfficial from "./pages/reports/PersonnelRealVsOfficial";
// import Patrimony from "./pages/reports/Patrimony";

// Configurações avançadas
// import FiscalBase from "./pages/settings/FiscalBase";
// import Partners from "./pages/settings/Partners";
// import AlertsConfig from "./pages/settings/AlertsConfig";
// import TaxConfig from "./pages/settings/TaxConfig";
// import DataSeed2025 from "./pages/settings/DataSeed2025";
// import FatorRAudit from "./pages/settings/FatorRAudit";
// import CardFeesConfig from "./pages/settings/CardFeesConfig";
// import Convenios from "./pages/settings/Convenios";

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
              
              {/* Sistema */}
              <Route path="/about" element={<About />} />
              <Route path="/changelog" element={<Changelog />} />

              {/* Módulo Interno Protegido (sem link no menu) */}
              <Route path="/settings/internal/fiscal-control" element={<FiscalControl />} />

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
              
              {/* Relatórios */}
              <Route path="/reports/cash-closings" element={<CashClosingReport />} />
              <Route path="/reports/transactions" element={<TransactionsReport />} />
              <Route path="/reports/cashflow-projection" element={<CashflowProjection />} />
              <Route path="/reports/lis-closures" element={<LisClosuresReport />} />
              
              {/* Importações */}
              <Route path="/import/daily-movement" element={<DailyMovement />} />
              <Route path="/import/bank-statement" element={<BankStatement />} />
              <Route path="/import/convenio-reports" element={<ConvenioReportsImport />} />

              {/* ============================================ */}
              {/* ARCHIVED ROUTES - Comentadas */}
              {/* ============================================ */}
              {/* 
              <Route path="/cash-closing" element={<CashClosingSimple />} />
              <Route path="/cash-closing-advanced" element={<CashClosing />} />
              <Route path="/lis/fechamento" element={<LisFechamento />} />
              <Route path="/lis/cash-closing-select" element={<CashClosingWithSelection />} />
              <Route path="/envelope-closing" element={<EnvelopeCashClosing />} />
              <Route path="/pix-closing" element={<PixClosing />} />
              <Route path="/card-closing" element={<CardClosing />} />
              <Route path="/cash-hub" element={<CashHub />} />
              <Route path="/settings/fiscal-base" element={<FiscalBase />} />
              <Route path="/settings/partners" element={<Partners />} />
              <Route path="/settings/tax-config" element={<TaxConfig />} />
              <Route path="/settings/fator-r-audit" element={<FatorRAudit />} />
              <Route path="/settings/alerts" element={<AlertsConfig />} />
              <Route path="/settings/data-2025" element={<DataSeed2025 />} />
              <Route path="/settings/card-fees" element={<CardFeesConfig />} />
              <Route path="/settings/convenios" element={<Convenios />} />
              <Route path="/reports/tax-scenarios" element={<TaxScenarios />} />
              <Route path="/reports/personnel-real-vs-official" element={<PersonnelRealVsOfficial />} />
              <Route path="/reports/patrimony" element={<Patrimony />} />
              <Route path="/import/extrato-particulares" element={<ExtratoParticulares />} />
              <Route path="/audit/particular-vs-cash" element={<ParticularVsCash />} />
              <Route path="/audit/convenio-vs-invoice" element={<ConvenioVsInvoice />} />
              */}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
