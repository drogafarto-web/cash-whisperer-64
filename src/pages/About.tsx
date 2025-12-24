import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import labclinLogo from '@/assets/labclin-logo.png';
import { Info, Code, Calendar } from 'lucide-react';

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
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
