import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AccountingSettings {
  id: string;
  historico_inicio_mes: number;
  historico_inicio_ano: number;
  historico_fim_mes: number;
  historico_fim_ano: number;
  reminder_day: number;
  reminder_hour: number;
  updated_at: string;
}

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function getMonthName(mes: number): string {
  return MONTH_NAMES[mes] || '';
}

export function getMonthShortName(mes: number): string {
  return MONTH_NAMES[mes]?.slice(0, 3) || '';
}

// Generate email HTML for preview
export function generateEmailHtml(
  contactName: string,
  tipo: 'mensal' | 'historico',
  settings: AccountingSettings,
  ano?: number,
  mes?: number
): { html: string; subject: string } {
  let subject: string;
  let periodText: string;
  let instructionText: string;

  if (tipo === 'mensal') {
    subject = `Dados consolidados de ${getMonthName(mes!)}/${ano} – Labclin`;
    periodText = `${getMonthName(mes!)}/${ano}`;
    instructionText = `precisamos dos valores consolidados de ${periodText}`;
  } else {
    const inicio = `${getMonthShortName(settings.historico_inicio_mes)}/${settings.historico_inicio_ano}`;
    const fim = `${getMonthShortName(settings.historico_fim_mes)}/${settings.historico_fim_ano}`;
    subject = `Dados históricos ${inicio} a ${fim} – Labclin`;
    periodText = `${inicio} a ${fim}`;
    
    // Calculate months
    const totalMonths = 
      (settings.historico_fim_ano - settings.historico_inicio_ano) * 12 +
      (settings.historico_fim_mes - settings.historico_inicio_mes) + 1;
    instructionText = `precisamos dos valores históricos do período ${periodText} (${totalMonths} meses)`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📊 Labclin Finance</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Portal da Contabilidade</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
        <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${contactName}</strong>,</p>
        
        <p>Para calcular corretamente o <strong>Fator R</strong> e os cenários tributários do laboratório, ${instructionText}:</p>
        
        <ul style="list-style: none; padding: 0; margin: 20px 0;">
          <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
            <span style="color: #667eea;">📋</span> Folha de pagamento (salários, pró-labore, encargos)
          </li>
          <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
            <span style="color: #667eea;">💰</span> Receita de serviços do laboratório
          </li>
          <li style="padding: 8px 0;">
            <span style="color: #667eea;">🧾</span> Impostos pagos (DAS, ISS, IRRF e outros)
          </li>
        </ul>
        
        <p>Você pode informar esses valores em um <strong>formulário seguro</strong> no link abaixo:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
            👉 Acessar formulário de ${periodText}
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Este link é válido por <strong>30 dias</strong>. Assim que os dados forem enviados, 
          o sistema atualizará automaticamente os relatórios e cenários tributários.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; margin: 0;">
          Atenciosamente,<br>
          <strong>Labclin Finance</strong><br>
          <em>Sistema de Gestão Financeira</em>
        </p>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Fetch accounting settings
export function useAccountingSettings() {
  return useQuery({
    queryKey: ['accounting-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as AccountingSettings;
    },
  });
}

// Update accounting settings
export function useUpdateAccountingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<AccountingSettings> & { id: string }) => {
      const { id, ...updateData } = settings;
      const { data, error } = await supabase
        .from('accounting_settings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as AccountingSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
      toast.success('Configurações salvas');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar configurações: ' + error.message);
    },
  });
}
