import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Loader2, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Convenio {
  id: string;
  nome: string;
  codigo: string | null;
  tipo: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const TIPO_OPTIONS = [
  { value: 'convenio', label: 'Convênio' },
  { value: 'particular', label: 'Particular' },
  { value: 'sus', label: 'SUS' },
  { value: 'empresa', label: 'Empresa' },
];

export default function ConveniosSettings() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("convenio");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchConvenios();
    }
  }, [user]);

  const fetchConvenios = async () => {
    try {
      const { data, error } = await supabase
        .from("convenios")
        .select("*")
        .order("nome");

      if (error) throw error;
      setConvenios(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar convênios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("convenios")
          .update({
            nome: nome.trim(),
            codigo: codigo.trim() || null,
            tipo,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Convênio atualizado!");
      } else {
        const { error } = await supabase
          .from("convenios")
          .insert({
            nome: nome.trim(),
            codigo: codigo.trim() || null,
            tipo,
          });

        if (error) throw error;
        toast.success("Convênio criado!");
      }

      resetForm();
      fetchConvenios();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Já existe um convênio com este nome");
      } else {
        toast.error("Erro: " + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (convenio: Convenio) => {
    setEditingId(convenio.id);
    setNome(convenio.nome);
    setCodigo(convenio.codigo || "");
    setTipo(convenio.tipo);
    setDialogOpen(true);
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("convenios")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentActive ? "Convênio desativado" : "Convênio ativado");
      fetchConvenios();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setCodigo("");
    setTipo("convenio");
    setDialogOpen(false);
  };

  const filteredConvenios = convenios.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Convênios</h1>
            <p className="text-muted-foreground">
              Cadastro de convênios, planos de saúde e modalidades de pagamento
            </p>
          </div>
          
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              if (!open) resetForm();
              setDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Convênio
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Editar Convênio" : "Novo Convênio"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId 
                      ? "Atualize as informações do convênio"
                      : "Adicione um novo convênio ao sistema"
                    }
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: UNIMED"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código (opcional)</Label>
                    <Input
                      id="codigo"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ex: UNI001"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingId ? "Salvar" : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Lista de Convênios</CardTitle>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar convênio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <CardDescription>
              {filteredConvenios.length} convênio(s) cadastrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConvenios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "Nenhum convênio encontrado" : "Nenhum convênio cadastrado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConvenios.map((convenio) => (
                    <TableRow key={convenio.id}>
                      <TableCell className="font-medium">{convenio.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {convenio.codigo || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_OPTIONS.find(t => t.value === convenio.tipo)?.label || convenio.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Switch
                            checked={convenio.active}
                            onCheckedChange={() => handleToggleActive(convenio.id, convenio.active)}
                          />
                        ) : (
                          <Badge variant={convenio.active ? "default" : "secondary"}>
                            {convenio.active ? "Ativo" : "Inativo"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(convenio.updated_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(convenio)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
