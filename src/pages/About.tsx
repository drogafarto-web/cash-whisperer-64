import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import labclinLogo from '@/assets/labclin-logo.png';
import { Info, Code, Calendar, Mail, Phone, HelpCircle, History, ExternalLink, MessageCircleQuestion } from 'lucide-react';

const faqs = [
  {
    question: "Como faço para realizar o fechamento de caixa?",
    answer: "Acesse o menu 'Fechamento' no painel lateral e clique em 'Novo Fechamento'. Preencha os valores de entrada e saída do dia e confirme. O sistema calculará automaticamente as diferenças e gerará o relatório."
  },
  {
    question: "Como importar arquivos do sistema LIS?",
    answer: "Na seção 'Importar', selecione 'Movimento Diário' ou 'Fechamento LIS'. Escolha o arquivo .xlsx gerado pelo sistema LIS e clique em 'Processar'. O sistema irá validar e importar os dados automaticamente."
  },
  {
    question: "O que é o Fator R e como afeta minha empresa?",
    answer: "O Fator R é o percentual da folha de pagamento em relação à receita bruta dos últimos 12 meses. Se for igual ou superior a 28%, sua empresa pode se enquadrar no Anexo III do Simples Nacional, com alíquotas menores. O sistema monitora esse indicador e alerta quando há oportunidades de otimização."
  },
  {
    question: "Como funciona o sistema de alertas?",
    answer: "O sistema monitora automaticamente indicadores críticos como Fator R abaixo do limite, pendências de fechamento e vencimentos de notas fiscais. Alertas são exibidos no dashboard e podem ser configurados em 'Configurações > Alertas' para receber notificações por email."
  },
  {
    question: "Quais perfis de acesso existem no sistema?",
    answer: "Existem 4 perfis: Admin (acesso total ao sistema), Contabilidade (relatórios e análise tributária), Gestor de Unidade (operações completas da unidade) e Secretaria/Atendente (fechamento de caixa e operações básicas do dia a dia)."
  },
  {
    question: "Como a contabilidade externa acessa o sistema?",
    answer: "A contabilidade pode acessar através do portal externo com link seguro e temporário. Configure o acesso em 'Configurações > Contabilidade Externa' para gerar links de acesso. Os links podem ser configurados para expirar após um período determinado."
  },
  {
    question: "Como funciona o OCR para notas fiscais?",
    answer: "Ao fazer upload de uma nota fiscal em PDF ou imagem, o sistema utiliza reconhecimento óptico de caracteres (OCR) para extrair automaticamente dados como valor, data, CNPJ e descrição. Você pode revisar e ajustar os dados antes de salvar."
  },
  {
    question: "Posso exportar relatórios do sistema?",
    answer: "Sim! Os principais relatórios podem ser exportados em formato PDF ou Excel. Acesse a seção de Relatórios, configure os filtros desejados e clique no botão de exportação. Em breve, novas opções de exportação estarão disponíveis."
  },
];

export default function About() {
  const version = "1.0.1";
  const buildDate = "Dezembro 2024";

  return (
    <AppLayout>
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <img 
                src={labclinLogo} 
                alt="LabClin" 
                className="w-24 h-24 mx-auto object-contain mb-4"
              />
              <CardTitle className="text-2xl">LabClin</CardTitle>
              <p className="text-muted-foreground">Sistema de Gestão Financeira</p>
              <Badge variant="secondary" className="mt-2">v{version}</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Descrição */}
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">Sobre o Sistema</h3>
                  <p className="text-sm text-muted-foreground">
                    Sistema desenvolvido para gestão financeira de laboratórios clínicos,
                    incluindo controle de caixa, faturamento, análise tributária e
                    prestação de contas.
                  </p>
                </div>
              </div>

              {/* Informações Técnicas */}
              <div className="flex items-start gap-3">
                <Code className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">Tecnologias</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">React 18</Badge>
                    <Badge variant="outline">TypeScript</Badge>
                    <Badge variant="outline">Tailwind CSS</Badge>
                    <Badge variant="outline">Vite</Badge>
                  </div>
                </div>
              </div>

              {/* Data de Build */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">Última Atualização</h3>
                  <p className="text-sm text-muted-foreground">{buildDate}</p>
                </div>
              </div>

              {/* Contato e Suporte */}
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-3">
                  <h3 className="font-medium">Contato e Suporte</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <a href="mailto:suporte@labclin.com.br" className="hover:underline hover:text-primary">
                        suporte@labclin.com.br
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>(84) 3333-0000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Histórico de Versões */}
              <div className="flex items-start gap-3">
                <History className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium">Histórico de Versões</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Veja todas as atualizações e melhorias do sistema.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/changelog">
                      Ver Changelog
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleQuestion className="w-5 h-5 text-primary" />
                Perguntas Frequentes (FAQ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}