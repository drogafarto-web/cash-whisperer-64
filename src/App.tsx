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
import CashClosingReport from "./pages/reports/CashClosingReport";
import TransactionsReport from "./pages/reports/TransactionsReport";
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
            <Route path="/reports/cash-closings" element={<CashClosingReport />} />
            <Route path="/reports/transactions" element={<TransactionsReport />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
