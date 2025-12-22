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
import UsersSettings from "./pages/settings/Users";
import UnitsSettings from "./pages/settings/Units";
import AccountsSettings from "./pages/settings/Accounts";
import CategoriesSettings from "./pages/settings/Categories";
import PartnersSettings from "./pages/settings/Partners";
import CashClosingReport from "./pages/reports/CashClosingReport";
import TransactionsReport from "./pages/reports/TransactionsReport";
import TaxScenarios from "./pages/reports/TaxScenarios";
import TaxConfigPage from "./pages/settings/TaxConfig";
import FatorRAudit from "./pages/settings/FatorRAudit";
import DailyMovementImport from "./pages/import/DailyMovement";
import BankStatementImport from "./pages/import/BankStatement";
import NotFound from "./pages/NotFound";

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
            <Route path="/settings/users" element={<UsersSettings />} />
            <Route path="/settings/units" element={<UnitsSettings />} />
            <Route path="/settings/accounts" element={<AccountsSettings />} />
            <Route path="/settings/categories" element={<CategoriesSettings />} />
            <Route path="/settings/partners" element={<PartnersSettings />} />
            <Route path="/settings/tax-config" element={<TaxConfigPage />} />
            <Route path="/settings/fator-r-audit" element={<FatorRAudit />} />
            <Route path="/reports/cash-closings" element={<CashClosingReport />} />
            <Route path="/reports/transactions" element={<TransactionsReport />} />
            <Route path="/reports/tax-scenarios" element={<TaxScenarios />} />
            <Route path="/import/daily-movement" element={<DailyMovementImport />} />
            <Route path="/import/bank-statement" element={<BankStatementImport />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
