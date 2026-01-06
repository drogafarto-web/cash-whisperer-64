import { lazy } from 'react';

// ============================================
// AUTH & SYSTEM
// ============================================
export const Auth = lazy(() => import('@/pages/Auth'));
export const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
export const NotFound = lazy(() => import('@/pages/NotFound'));
export const About = lazy(() => import('@/pages/About'));
export const Changelog = lazy(() => import('@/pages/Changelog'));

// ============================================
// DASHBOARD
// ============================================
export const Dashboard = lazy(() => import('@/pages/Dashboard'));

// ============================================
// OPERATIONS (Caixa, Recepção)
// ============================================
export const Transactions = lazy(() => import('@/pages/Transactions'));
export const CashClosingSimple = lazy(() => import('@/pages/CashClosingSimple'));
export const EnvelopeCashClosing = lazy(() => import('@/pages/EnvelopeCashClosing'));
export const Pendencias = lazy(() => import('@/pages/Pendencias'));
export const ReceptionPanel = lazy(() => import('@/pages/core/ReceptionPanel'));

// ============================================
// PAYABLES (Contas a Pagar)
// ============================================
export const Boletos = lazy(() => import('@/pages/payables/Boletos'));
export const SupplierInvoices = lazy(() => import('@/pages/payables/SupplierInvoices'));
export const TaxDocuments = lazy(() => import('@/pages/payables/TaxDocuments'));
export const PayablesDashboard = lazy(() => import('@/pages/payables/Dashboard'));
export const BulkManagement = lazy(() => import('@/pages/payables/BulkManagement'));
export const PayablesReconciliation = lazy(() => import('@/pages/payables/Reconciliation'));

// ============================================
// BILLING (Faturamento)
// ============================================
export const Invoices = lazy(() => import('@/pages/billing/Invoices'));
export const Payers = lazy(() => import('@/pages/billing/Payers'));
export const BillingSummary = lazy(() => import('@/pages/billing/Summary'));

// ============================================
// ACCOUNTING (Contabilidade)
// ============================================
export const AccountingPanel = lazy(() => import('@/pages/AccountingPanel'));
export const AccountingForm = lazy(() => import('@/pages/accounting/AccountingForm'));
export const AccountingBankStatements = lazy(() => import('@/pages/accounting/AccountingBankStatements'));
export const AccountingHistory = lazy(() => import('@/pages/AccountingHistory'));
export const AccountingAudit = lazy(() => import('@/pages/AccountingAudit'));

// ============================================
// REPORTS (Relatórios)
// ============================================
export const CashClosingReport = lazy(() => import('@/pages/reports/CashClosingReport'));
export const TransactionsReport = lazy(() => import('@/pages/reports/TransactionsReport'));
export const TaxScenarios = lazy(() => import('@/pages/reports/TaxScenarios'));
export const CashflowProjection = lazy(() => import('@/pages/reports/CashflowProjection'));
export const LisClosuresReport = lazy(() => import('@/pages/reports/LisClosuresReport'));
export const PersonnelRealVsOfficial = lazy(() => import('@/pages/reports/PersonnelRealVsOfficial'));
export const LisReconciliation = lazy(() => import('@/pages/reports/LisReconciliation'));
export const EnvelopeConferencia = lazy(() => import('@/pages/reports/EnvelopeConferencia'));

// ============================================
// SETTINGS (Configurações)
// ============================================
export const SettingsHub = lazy(() => import('@/pages/settings/SettingsHub'));
export const Units = lazy(() => import('@/pages/settings/Units'));
export const Accounts = lazy(() => import('@/pages/settings/Accounts'));
export const Categories = lazy(() => import('@/pages/settings/Categories'));
export const Users = lazy(() => import('@/pages/settings/Users'));
export const Partners = lazy(() => import('@/pages/settings/Partners'));
export const TaxConfig = lazy(() => import('@/pages/settings/TaxConfig'));
export const FiscalBase = lazy(() => import('@/pages/settings/FiscalBase'));
export const FatorRAudit = lazy(() => import('@/pages/settings/FatorRAudit'));
export const FiscalControl = lazy(() => import('@/pages/internal/FiscalControl'));

// ============================================
// IMPORT (Importações)
// ============================================
export const DailyMovement = lazy(() => import('@/pages/import/DailyMovement'));
export const BankStatement = lazy(() => import('@/pages/import/BankStatement'));
export const ConvenioReportsImport = lazy(() => import('@/pages/import/ConvenioReports'));
