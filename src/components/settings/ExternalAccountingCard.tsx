import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  Eye,
  Settings,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { 
  useAccountingContacts, 
  useCreateAccountingContact, 
  useSendAccountingLink, 
  useAccountingEmailLogs,
} from '@/hooks/useAccountingData';
import { 
  useAccountingSettings, 
  useUpdateAccountingSettings,
  generateEmailHtml,
  getMonthShortName,
} from '@/hooks/useAccountingSettings';

interface ExternalAccountingCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const YEARS = [2024, 2025, 2026];
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ExternalAccountingCard({ isOpen, onToggle }: ExternalAccountingCardProps) {
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [newContact, setNewContact] = useState({
    nome: '',
    email: '',
    empresa: '',
    telefone: '',
  });

  const { data: contacts = [], isLoading: contactsLoading } = useAccountingContacts();
  const { data: emailLogs = [] } = useAccountingEmailLogs();
  const { data: settings, isLoading: settingsLoading } = useAccountingSettings();
  const createContact = useCreateAccountingContact();
  const sendLink = useSendAccountingLink();
  const updateSettings = useUpdateAccountingSettings();

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
    if (!selectedContactId || !settings) {
      toast.error('Selecione um contato primeiro');
      return;
    }

    try {
      await sendLink.mutateAsync({
        contact_id: selectedContactId,
        tipo: 'historico',
        ano_inicio: settings.historico_inicio_ano,
        mes_inicio: settings.historico_inicio_mes,
        ano_fim: settings.historico_fim_ano,
        mes_fim: settings.historico_fim_mes,
      });
      setShowConfirmDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdateSettings = (field: string, value: number) => {
    if (!settings) return;
    updateSettings.mutate({ id: settings.id, [field]: value });
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
    if (status === 'sent') return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  };

  // Get recent logs for selected contact
  const recentLogs = emailLogs
    .filter(log => log.contact_id === selectedContactId)
    .slice(0, 5);

  // Period text for display
  const periodText = settings 
    ? `${getMonthShortName(settings.historico_inicio_mes)}/${settings.historico_inicio_ano} a ${getMonthShortName(settings.historico_fim_mes)}/${settings.historico_fim_ano}`
    : 'Nov/2024 a Dez/2025';

  // Calculate total months
  const totalMonths = settings
    ? (settings.historico_fim_ano - settings.historico_inicio_ano) * 12 +
      (settings.historico_fim_mes - settings.historico_inicio_mes) + 1
    : 14;

  // Generate preview HTML
  const previewData = settings && selectedContact
    ? generateEmailHtml(selectedContact.nome, 'historico', settings)
    : null;

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
            <Tabs defaultValue="enviar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="enviar" className="gap-2">
                  <Send className="h-4 w-4" />
                  Enviar
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="config" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
              </TabsList>

              {/* Tab: Enviar */}
              <TabsContent value="enviar" className="space-y-4 mt-4">
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

                {/* Send Invite Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Preview Button */}
                  <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="gap-2" 
                        disabled={!selectedContactId}
                      >
                        <Eye className="h-4 w-4" />
                        Visualizar Email
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Preview do Email</DialogTitle>
                        <DialogDescription>
                          Visualize como o email será enviado para {selectedContact?.nome}
                        </DialogDescription>
                      </DialogHeader>
                      {previewData && (
                        <div className="space-y-4">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm"><strong>Assunto:</strong> {previewData.subject}</p>
                            <p className="text-sm"><strong>Para:</strong> {selectedContact?.email}</p>
                          </div>
                          <div 
                            className="border rounded-lg overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: previewData.html }}
                          />
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                          Fechar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Send Button */}
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
                          para preencher os dados históricos de <strong>{periodText}</strong>.
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
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Período: <strong>{totalMonths} meses</strong></span>
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
                    Período: {periodText} ({totalMonths} meses)
                  </span>
                </div>
              </TabsContent>

              {/* Tab: Histórico */}
              <TabsContent value="historico" className="space-y-4 mt-4">
                {emailLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum email enviado ainda</p>
                    <p className="text-sm">Os emails enviados aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emailLogs.slice(0, 20).map(log => (
                      <div 
                        key={log.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-background text-sm"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getStatusIcon(log.status)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{log.subject}</p>
                            <p className="text-muted-foreground text-xs truncate">→ {log.email_to}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-muted-foreground text-xs">
                            {formatDate(log.sent_at)}
                          </span>
                          {log.status === 'sent' && (
                            <Badge variant="outline" className="text-green-600 border-green-600/30">
                              Enviado
                            </Badge>
                          )}
                          {log.status === 'error' && (
                            <Badge variant="outline" className="text-destructive border-destructive/30">
                              Erro
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab: Configurações */}
              <TabsContent value="config" className="space-y-6 mt-4">
                {settingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : settings ? (
                  <>
                    {/* Período do Histórico */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-1">Período do Convite Histórico</h4>
                        <p className="text-xs text-muted-foreground">
                          Define o intervalo de meses solicitados no convite histórico
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Início</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={String(settings.historico_inicio_mes)} 
                              onValueChange={(v) => handleUpdateSettings('historico_inicio_mes', Number(v))}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTHS.map(m => (
                                  <SelectItem key={m.value} value={String(m.value)}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select 
                              value={String(settings.historico_inicio_ano)} 
                              onValueChange={(v) => handleUpdateSettings('historico_inicio_ano', Number(v))}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {YEARS.map(y => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Fim</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={String(settings.historico_fim_mes)} 
                              onValueChange={(v) => handleUpdateSettings('historico_fim_mes', Number(v))}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MONTHS.map(m => (
                                  <SelectItem key={m.value} value={String(m.value)}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select 
                              value={String(settings.historico_fim_ano)} 
                              onValueChange={(v) => handleUpdateSettings('historico_fim_ano', Number(v))}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {YEARS.map(y => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Lembrete Mensal */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-1">Lembrete Mensal Automático</h4>
                        <p className="text-xs text-muted-foreground">
                          Dia e hora para envio automático do lembrete mensal
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Dia do mês</Label>
                          <Select 
                            value={String(settings.reminder_day)} 
                            onValueChange={(v) => handleUpdateSettings('reminder_day', Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map(d => (
                                <SelectItem key={d} value={String(d)}>
                                  Dia {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Hora (BRT)</Label>
                          <Select 
                            value={String(settings.reminder_hour)} 
                            onValueChange={(v) => handleUpdateSettings('reminder_hour', Number(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS.map(h => (
                                <SelectItem key={h} value={String(h)}>
                                  {String(h).padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                        💡 O lembrete será enviado automaticamente no dia {settings.reminder_day} de cada mês 
                        às {String(settings.reminder_hour).padStart(2, '0')}:00 (horário de Brasília) 
                        para todos os contatos ativos, caso os dados do mês anterior não tenham sido recebidos.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Erro ao carregar configurações</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
