import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import labclinLogo from '@/assets/labclin-logo.png';
import { Info, Code, Calendar, Mail, Phone, HelpCircle, History, ExternalLink } from 'lucide-react';

export default function About() {
  const version = "1.0.0";
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
        </div>
      </div>
    </AppLayout>
  );
}
