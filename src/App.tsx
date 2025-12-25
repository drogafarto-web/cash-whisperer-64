import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import CashClosing from "./pages/CashClosing";
import CashClosingSimple from "./pages/CashClosingSimple";
import LisFechamento from "./pages/lis/LisFechamento";
import CashClosingWithSelection from "./pages/lis/CashClosingWithSelection";
import EnvelopeCashClosing from "./pages/EnvelopeCashClosing";
import PixClosing from "./pages/PixClosing";
import CardClosing from "./pages/CardClosing";
import CashHub from "./pages/CashHub";
import Pendencias from "./pages/Pendencias";
import NotFound from "./pages/NotFound";

// Settings pages
import SettingsHub from "./pages/settings/SettingsHub";
import FiscalBase from "./pages/settings/FiscalBase";
import Units from "./pages/settings/Units";
import Accounts from "./pages/settings/Accounts";
import Categories from "./pages/settings/Categories";
import Partners from "./pages/settings/Partners";
import Users from "./pages/settings/Users";
import AlertsConfig from "./pages/settings/AlertsConfig";
import TaxConfig from "./pages/settings/TaxConfig";
import DataSeed2025 from "./pages/settings/DataSeed2025";
import FatorRAudit from "./pages/settings/FatorRAudit";
import CardFeesConfig from "./pages/settings/CardFeesConfig";
import Convenios from "./pages/settings/Convenios";
import LisUsers from "./pages/settings/LisUsers";

// Report pages
import CashClosingReport from "./pages/reports/CashClosingReport";
import TransactionsReport from "./pages/reports/TransactionsReport";
import TaxScenarios from "./pages/reports/TaxScenarios";
import PersonnelRealVsOfficial from "./pages/reports/PersonnelRealVsOfficial";
import LisClosuresReport from "./pages/reports/LisClosuresReport";
import CashflowProjection from "./pages/reports/CashflowProjection";
import Patrimony from "./pages/reports/Patrimony";

// Import pages
import DailyMovement from "./pages/import/DailyMovement";
import BankStatement from "./pages/import/BankStatement";
import ExtratoParticulares from "./pages/import/ExtratoParticulares";
import ConvenioReportsImport from "./pages/import/ConvenioReports";

// Audit pages
import ParticularVsCash from "./pages/audit/ParticularVsCash";
import ConvenioVsInvoice from "./pages/audit/ConvenioVsInvoice";

// Accounting pages
import AccountingForm from "./pages/contabilidade/AccountingForm";

// Billing pages
import Invoices from "./pages/billing/Invoices";
import Payers from "./pages/billing/Payers";
import BillingSummary from "./pages/billing/Summary";

// Payables pages
import SupplierInvoices from "./pages/payables/SupplierInvoices";
import Boletos from "./pages/payables/Boletos";
import PayablesReconciliation from "./pages/payables/Reconciliation";
import PayablesDashboard from "./pages/payables/Dashboard";

// System pages
import About from "./pages/About";
import Changelog from "./pages/Changelog";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Navigate to="/transactions" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cash-closing" element={<CashClosingSimple />} />
            <Route path="/cash-closing-advanced" element={<CashClosing />} />
            <Route path="/lis/fechamento" element={<LisFechamento />} />
            <Route path="/lis/cash-closing-select" element={<CashClosingWithSelection />} />
            <Route path="/envelope-closing" element={<EnvelopeCashClosing />} />
            <Route path="/pix-closing" element={<PixClosing />} />
            <Route path="/card-closing" element={<CardClosing />} />
            <Route path="/cash-hub" element={<CashHub />} />
            <Route path="/settings" element={<SettingsHub />} />
            <Route path="/settings/fiscal-base" element={<FiscalBase />} />
            <Route path="/settings/users" element={<Users />} />
            <Route path="/settings/units" element={<Units />} />
            <Route path="/settings/accounts" element={<Accounts />} />
            <Route path="/settings/categories" element={<Categories />} />
            <Route path="/settings/partners" element={<Partners />} />
            <Route path="/settings/tax-config" element={<TaxConfig />} />
            <Route path="/settings/fator-r-audit" element={<FatorRAudit />} />
            <Route path="/settings/alerts" element={<AlertsConfig />} />
            <Route path="/settings/data-2025" element={<DataSeed2025 />} />
            <Route path="/settings/card-fees" element={<CardFeesConfig />} />
            <Route path="/settings/convenios" element={<Convenios />} />
            <Route path="/settings/lis-users" element={<LisUsers />} />
            <Route path="/reports/cash-closings" element={<CashClosingReport />} />
            <Route path="/reports/transactions" element={<TransactionsReport />} />
            <Route path="/reports/tax-scenarios" element={<TaxScenarios />} />
            <Route path="/reports/personnel-real-vs-official" element={<PersonnelRealVsOfficial />} />
            <Route path="/reports/lis-closures" element={<LisClosuresReport />} />
            <Route path="/reports/cashflow-projection" element={<CashflowProjection />} />
            <Route path="/reports/patrimony" element={<Patrimony />} />
            <Route path="/import/daily-movement" element={<DailyMovement />} />
            <Route path="/import/bank-statement" element={<BankStatement />} />
            <Route path="/import/extrato-particulares" element={<ExtratoParticulares />} />
            <Route path="/import/convenio-reports" element={<ConvenioReportsImport />} />
            <Route path="/audit/particular-vs-cash" element={<ParticularVsCash />} />
            <Route path="/audit/convenio-vs-invoice" element={<ConvenioVsInvoice />} />
            <Route path="/pendencias" element={<Pendencias />} />
            <Route path="/contabilidade/dados/:token" element={<AccountingForm />} />
            <Route path="/billing/invoices" element={<Invoices />} />
            <Route path="/billing/payers" element={<Payers />} />
            <Route path="/billing/summary" element={<BillingSummary />} />
            <Route path="/payables/dashboard" element={<PayablesDashboard />} />
            <Route path="/payables/supplier-invoices" element={<SupplierInvoices />} />
            <Route path="/payables/boletos" element={<Boletos />} />
            <Route path="/payables/reconciliation" element={<PayablesReconciliation />} />
            <Route path="/about" element={<About />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
