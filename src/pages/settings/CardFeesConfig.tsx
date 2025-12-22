import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2, Save } from 'lucide-react';

export default function CardFeesConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ['cardFees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('card_fee_config')
        .select('*')
        .order('name');
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, fee_percent }: { id: string; fee_percent: number }) => {
      const { error } = await supabase
        .from('card_fee_config')
        .update({ fee_percent })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cardFees'] });
      toast({ title: 'Taxa atualizada' });
    },
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleSave = (id: string) => {
    const value = parseFloat(editValues[id] || '0');
    if (isNaN(value) || value < 0 || value > 100) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({ id, fee_percent: value });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Taxas de Cartão</h1>
          <p className="text-muted-foreground">
            Configure o percentual de taxa cobrado por tipo de cartão
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {fees.map(fee => (
              <Card key={fee.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {fee.name}
                  </CardTitle>
                  <CardDescription>
                    Taxa atual: {fee.fee_percent}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Nova taxa (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={editValues[fee.id] ?? fee.fee_percent}
                        onChange={e => setEditValues(v => ({ ...v, [fee.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(fee.id)}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
