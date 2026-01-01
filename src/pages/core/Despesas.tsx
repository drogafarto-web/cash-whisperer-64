import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Barcode, FileText, Calculator, CreditCard } from 'lucide-react';

// Import existing page contents as components
import BoletosPage from '@/pages/payables/Boletos';
import SupplierInvoicesPage from '@/pages/payables/SupplierInvoices';
import TaxDocumentsPage from '@/pages/payables/TaxDocuments';

/**
 * Despesas - Página unificada de Contas a Pagar
 * 
 * Consolida 3 funcionalidades em uma única tela com tabs:
 * 1. Boletos - Pagamentos pendentes com código de barras/PIX
 * 2. NFs Fornecedor - Notas fiscais de entrada
 * 3. Guias Fiscais - DARF, GPS, FGTS, DAS
 * 
 * Fluxo de dados:
 * - Tab Boletos: usa usePayablesWithPaymentData → payables table
 * - Tab NFs: usa useSupplierInvoices → supplier_invoices table
 * - Tab Guias: usa accounting_lab_documents table
 */
export default function Despesas() {
  const [activeTab, setActiveTab] = useState('boletos');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Despesas
          </h1>
          <p className="text-muted-foreground">
            Gerencie boletos, notas fiscais de fornecedor e guias tributárias
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="boletos" className="gap-2">
              <Barcode className="h-4 w-4" />
              Boletos
            </TabsTrigger>
            <TabsTrigger value="nfs" className="gap-2">
              <FileText className="h-4 w-4" />
              NFs Fornecedor
            </TabsTrigger>
            <TabsTrigger value="guias" className="gap-2">
              <Calculator className="h-4 w-4" />
              Guias Fiscais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boletos" className="mt-6">
            <BoletosContent />
          </TabsContent>

          <TabsContent value="nfs" className="mt-6">
            <SupplierInvoicesContent />
          </TabsContent>

          <TabsContent value="guias" className="mt-6">
            <TaxDocumentsContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Componentes internos que renderizam o conteúdo sem o AppLayout wrapper
// (para evitar AppLayout duplicado quando usados como tabs)

function BoletosContent() {
  // Re-exporta o conteúdo de Boletos sem wrapper
  // Por ora, redireciona para a página existente
  // TODO: Extrair conteúdo interno de Boletos.tsx para um componente separado
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>Carregando boletos...</p>
      <p className="text-sm mt-2">
        <a href="/payables/boletos" className="text-primary hover:underline">
          Abrir página de boletos →
        </a>
      </p>
    </div>
  );
}

function SupplierInvoicesContent() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>Carregando notas fiscais...</p>
      <p className="text-sm mt-2">
        <a href="/payables/supplier-invoices" className="text-primary hover:underline">
          Abrir página de NFs →
        </a>
      </p>
    </div>
  );
}

function TaxDocumentsContent() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>Carregando guias fiscais...</p>
      <p className="text-sm mt-2">
        <a href="/payables/tax-documents" className="text-primary hover:underline">
          Abrir página de guias →
        </a>
      </p>
    </div>
  );
}
