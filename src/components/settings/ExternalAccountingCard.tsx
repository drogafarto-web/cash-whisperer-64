import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Mail, 
  Send, 
  Plus, 
  User2,
  ChevronDown,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { 
  useAccountingContacts, 
  useCreateAccountingContact, 
  useSendAccountingLink, 
  useAccountingEmailLogs,
  AccountingContact,
} from '@/hooks/useAccountingData';

interface ExternalAccountingCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ExternalAccountingCard({ isOpen, onToggle }: ExternalAccountingCardProps) {
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newContact, setNewContact] = useState({
    nome: '',
    email: '',
    empresa: '',
    telefone: '',
  });

  const { data: contacts = [], isLoading: contactsLoading } = useAccountingContacts();
  const { data: emailLogs = [] } = useAccountingEmailLogs();
  const createContact = useCreateAccountingContact();
  const sendLink = useSendAccountingLink();

  const activeContacts = contacts.filter(c => c.ativo);
  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const handleCreateContact = async () => {
    if (!newContact.nome || !newContact.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    
    try {
      const created = await createContact.mutateAsync(newContact);
      setSelectedContactId(created.id);
      setNewContact({ nome: '', email: '', empresa: '', telefone: '' });
      setShowNewContactForm(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSendHistoricoInvite = async () => {
    if (!selectedContactId) {
      toast.error('Selecione um contato primeiro');
      return;
    }

    try {
      await sendLink.mutateAsync({
        contact_id: selectedContactId,
        tipo: 'historico',
        ano_inicio: 2024,
        mes_inicio: 11,
        ano_fim: 2025,
        mes_fim: 12,
      });
      setShowConfirmDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    if (status === 'sent') return <CheckCircle className="h-4 w-4 text-success" />;
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  };

  // Get recent logs for selected contact
  const recentLogs = emailLogs
    .filter(log => log.contact_id === selectedContactId)
    .slice(0, 5);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="border-2 border-violet-500/30">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Mail className="h-6 w-6 text-violet-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Contabilidade Externa</CardTitle>
                  <CardDescription>Envie convites para contadores preencherem dados históricos</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-700">
                  Portal Externo
                </Badge>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Contact Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Selecionar Contato</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowNewContactForm(!showNewContactForm)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Novo Contato
                </Button>
              </div>

              {showNewContactForm && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input 
                        placeholder="Nome do contador"
                        value={newContact.nome}
                        onChange={(e) => setNewContact(prev => ({ ...prev, nome: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email *</Label>
                      <Input 
                        type="email"
                        placeholder="email@contabilidade.com"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Empresa</Label>
                      <Input 
                        placeholder="Nome da empresa"
                        value={newContact.empresa}
                        onChange={(e) => setNewContact(prev => ({ ...prev, empresa: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input 
                        placeholder="(00) 00000-0000"
                        value={newContact.telefone}
                        onChange={(e) => setNewContact(prev => ({ ...prev, telefone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowNewContactForm(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleCreateContact}
                      disabled={createContact.isPending}
                    >
                      {createContact.isPending ? 'Salvando...' : 'Salvar Contato'}
                    </Button>
                  </div>
                </div>
              )}

              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato..." />
                </SelectTrigger>
                <SelectContent>
                  {activeContacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      <div className="flex items-center gap-2">
                        <User2 className="h-4 w-4" />
                        <span>{contact.nome}</span>
                        {contact.empresa && (
                          <span className="text-muted-foreground">- {contact.empresa}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedContact && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedContact.email}</span>
                    </div>
                    {selectedContact.telefone && (
                      <span className="text-muted-foreground">• {selectedContact.telefone}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Send Invite Button */}
            <div className="flex items-center gap-4">
              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="gap-2" 
                    disabled={!selectedContactId}
                  >
                    <Send className="h-4 w-4" />
                    Enviar Convite para Histórico
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Envio de Convite</DialogTitle>
                    <DialogDescription>
                      Um email será enviado para <strong>{selectedContact?.email}</strong> com um link 
                      para preencher os dados históricos de <strong>Nov/2024 a Dez/2025</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>O link expira em <strong>30 dias</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span>O contador acessará um formulário seguro</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSendHistoricoInvite}
                      disabled={sendLink.isPending}
                      className="gap-2"
                    >
                      {sendLink.isPending ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Confirmar Envio
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <span className="text-sm text-muted-foreground">
                Período: Nov/2024 a Dez/2025 (14 meses)
              </span>
            </div>

            {/* Email History */}
            {recentLogs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Histórico de Emails</Label>
                <div className="space-y-2">
                  {recentLogs.map(log => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-background text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <span className="font-medium">{log.subject}</span>
                          <span className="text-muted-foreground ml-2">→ {log.email_to}</span>
                        </div>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(log.sent_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
