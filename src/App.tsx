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
import LisFechamento from "./pages/lis/LisFechamento";
import Pendencias from "./pages/Pendencias";
import NotFound from "./pages/NotFound";

// Settings pages
import SettingsHub from "./pages/settings/SettingsHub";
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

// Report pages
import CashClosingReport from "./pages/reports/CashClosingReport";
import TransactionsReport from "./pages/reports/TransactionsReport";
import TaxScenarios from "./pages/reports/TaxScenarios";
import PersonnelRealVsOfficial from "./pages/reports/PersonnelRealVsOfficial";
import LisClosuresReport from "./pages/reports/LisClosuresReport";

// Import pages
import DailyMovement from "./pages/import/DailyMovement";
import BankStatement from "./pages/import/BankStatement";
import ExtratoParticulares from "./pages/import/ExtratoParticulares";

// Accounting pages
import AccountingForm from "./pages/contabilidade/AccountingForm";

// Billing pages
import Invoices from "./pages/billing/Invoices";
import Payers from "./pages/billing/Payers";
import BillingSummary from "./pages/billing/Summary";

// System pages
import About from "./pages/About";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/transactions" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cash-closing" element={<CashClosing />} />
            <Route path="/lis/fechamento" element={<LisFechamento />} />
            <Route path="/settings" element={<SettingsHub />} />
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
            <Route path="/reports/cash-closings" element={<CashClosingReport />} />
            <Route path="/reports/transactions" element={<TransactionsReport />} />
            <Route path="/reports/tax-scenarios" element={<TaxScenarios />} />
            <Route path="/reports/personnel-real-vs-official" element={<PersonnelRealVsOfficial />} />
            <Route path="/reports/lis-closures" element={<LisClosuresReport />} />
            <Route path="/import/daily-movement" element={<DailyMovement />} />
            <Route path="/import/bank-statement" element={<BankStatement />} />
            <Route path="/import/extrato-particulares" element={<ExtratoParticulares />} />
            <Route path="/pendencias" element={<Pendencias />} />
            <Route path="/contabilidade/dados/:token" element={<AccountingForm />} />
            <Route path="/billing/invoices" element={<Invoices />} />
            <Route path="/billing/payers" element={<Payers />} />
            <Route path="/billing/summary" element={<BillingSummary />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
