/**
 * ARCHIVED ROUTES
 * 
 * Este arquivo contém imports e rotas que foram desativadas.
 * Mantido para referência histórica e reativação futura.
 * 
 * Como reativar uma rota:
 * 1. Descomente o import desejado
 * 2. Descomente a rota correspondente
 * 3. Mova ambos para App.tsx na seção apropriada
 * 4. Adicione ao menu em navigation.config.ts se necessário
 * 
 * @see src/pages/_archived/README.md para mais detalhes
 */

// ============================================
// ARCHIVED IMPORTS
// ============================================

// Fechamentos de caixa (múltiplas variações)
// import CashClosing from "@/pages/CashClosing";
// ✅ REATIVADO: import CashClosingSimple from "@/pages/CashClosingSimple"; → movido para App.tsx
// import LisFechamento from "@/pages/lis/LisFechamento";
// import CashClosingWithSelection from "@/pages/lis/CashClosingWithSelection";
// ✅ REATIVADO: import EnvelopeCashClosing from "@/pages/EnvelopeCashClosing"; → movido para App.tsx
// import PixClosing from "@/pages/PixClosing";
// import CardClosing from "@/pages/CardClosing";
// import CashHub from "@/pages/CashHub";

// Auditorias avançadas
// import ParticularVsCash from "@/pages/audit/ParticularVsCash";
// import ConvenioVsInvoice from "@/pages/audit/ConvenioVsInvoice";
// import ExtratoParticulares from "@/pages/import/ExtratoParticulares";

// Relatórios avançados
// import TaxScenarios from "@/pages/reports/TaxScenarios";
// import PersonnelRealVsOfficial from "@/pages/reports/PersonnelRealVsOfficial";
// import Patrimony from "@/pages/reports/Patrimony";

// Configurações avançadas
// import FiscalBase from "@/pages/settings/FiscalBase";
// import Partners from "@/pages/settings/Partners";
// import AlertsConfig from "@/pages/settings/AlertsConfig";
// ✅ REATIVADO: import TaxConfig from "@/pages/settings/TaxConfig"; → movido para App.tsx
// import DataSeed2025 from "@/pages/settings/DataSeed2025";
// import FatorRAudit from "@/pages/settings/FatorRAudit";
// import CardFeesConfig from "@/pages/settings/CardFeesConfig";
// import Convenios from "@/pages/settings/Convenios";

// ============================================
// ARCHIVED ROUTES
// ============================================
// Para usar estas rotas, descomente e adicione ao <Routes> em App.tsx
//
// {/* Fechamentos de caixa */}
// ✅ REATIVADO: <Route path="/cash-closing" element={<CashClosingSimple />} /> → movido para App.tsx
// <Route path="/cash-closing-advanced" element={<CashClosing />} />
// <Route path="/lis/fechamento" element={<LisFechamento />} />
// <Route path="/lis/cash-closing-select" element={<CashClosingWithSelection />} />
// ✅ REATIVADO: <Route path="/envelope-closing" element={<EnvelopeCashClosing />} /> → movido para App.tsx
// <Route path="/pix-closing" element={<PixClosing />} />
// <Route path="/card-closing" element={<CardClosing />} />
// <Route path="/cash-hub" element={<CashHub />} />
//
// {/* Configurações avançadas */}
// <Route path="/settings/fiscal-base" element={<FiscalBase />} />
// <Route path="/settings/partners" element={<Partners />} />
// ✅ REATIVADO: <Route path="/settings/tax-config" element={<TaxConfig />} /> → movido para App.tsx
// <Route path="/settings/fator-r-audit" element={<FatorRAudit />} />
// <Route path="/settings/alerts" element={<AlertsConfig />} />
// <Route path="/settings/data-2025" element={<DataSeed2025 />} />
// <Route path="/settings/card-fees" element={<CardFeesConfig />} />
// <Route path="/settings/convenios" element={<Convenios />} />
//
// {/* Relatórios avançados */}
// <Route path="/reports/tax-scenarios" element={<TaxScenarios />} />
// <Route path="/reports/personnel-real-vs-official" element={<PersonnelRealVsOfficial />} />
// <Route path="/reports/patrimony" element={<Patrimony />} />
//
// {/* Auditorias */}
// <Route path="/import/extrato-particulares" element={<ExtratoParticulares />} />
// <Route path="/audit/particular-vs-cash" element={<ParticularVsCash />} />
// <Route path="/audit/convenio-vs-invoice" element={<ConvenioVsInvoice />} />
