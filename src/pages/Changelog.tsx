import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { History, ArrowLeft, Plus, Bug, Sparkles, Rocket } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  status: 'released' | 'planned';
  changes: {
    type: 'new' | 'fix' | 'improvement';
    description: string;
  }[];
}

const changelogEntries: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "Fevereiro 2025",
    status: "planned",
    changes: [
      { type: "new", description: "Integração com sistemas de laboratório externos" },
      { type: "new", description: "Módulo de relatórios personalizados" },
      { type: "improvement", description: "Dashboard com gráficos interativos avançados" },
      { type: "improvement", description: "Suporte a múltiplos idiomas" },
    ],
  },
  {
    version: "1.1.0",
    date: "Janeiro 2025",
    status: "planned",
    changes: [
      { type: "new", description: "Exportação de relatórios em PDF e Excel" },
      { type: "new", description: "Notificações por email para alertas críticos" },
      { type: "improvement", description: "Melhoria na performance de carregamento" },
      { type: "improvement", description: "Interface responsiva para dispositivos móveis" },
    ],
  },
  {
    version: "1.0.1",
    date: "Dezembro 2024",
    status: "released",
    changes: [
      { type: "fix", description: "Correção no cálculo do Fator R para cenários específicos" },
      { type: "fix", description: "Ajuste na exibição de datas no relatório de transações" },
      { type: "improvement", description: "Melhoria na validação de campos do formulário de notas fiscais" },
    ],
  },
  {
    version: "1.0.0",
    date: "Dezembro 2024",
    status: "released",
    changes: [
      { type: "new", description: "Lançamento inicial do sistema" },
      { type: "new", description: "Dashboard com indicadores de desempenho" },
      { type: "new", description: "Módulo de fechamento de caixa" },
      { type: "new", description: "Importação de arquivos LIS" },
      { type: "new", description: "Gestão de notas fiscais com OCR" },
      { type: "new", description: "Cenários tributários e simulação Fator R" },
      { type: "new", description: "Sistema de alertas e notificações" },
      { type: "new", description: "Controle de acesso por perfis (admin, contabilidade, gestor, atendente)" },
      { type: "new", description: "Portal externo para contabilidade" },
      { type: "new", description: "Relatórios de fechamento e transações" },
    ],
  },
];

const getTypeBadge = (type: 'new' | 'fix' | 'improvement') => {
  switch (type) {
    case 'new':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Plus className="w-3 h-3 mr-1" />
          Novo
        </Badge>
      );
    case 'fix':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <Bug className="w-3 h-3 mr-1" />
          Correção
        </Badge>
      );
    case 'improvement':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Sparkles className="w-3 h-3 mr-1" />
          Melhoria
        </Badge>
      );
  }
};

const plannedEntries = changelogEntries.filter(e => e.status === 'planned');
const releasedEntries = changelogEntries.filter(e => e.status === 'released');

export default function Changelog() {
  return (
    <AppLayout>
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Changelog</h1>
                <p className="text-muted-foreground">Histórico de versões e atualizações</p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/about">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Link>
            </Button>
          </div>

          {/* Legenda */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-center text-sm">
                <span className="text-muted-foreground">Legenda:</span>
                {getTypeBadge('new')}
                {getTypeBadge('fix')}
                {getTypeBadge('improvement')}
              </div>
            </CardContent>
          </Card>

          {/* Roadmap */}
          {plannedEntries.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-8">
                <Rocket className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Roadmap</h2>
                <Badge variant="outline" className="ml-2">Planejado</Badge>
              </div>
              {plannedEntries.map((entry) => (
                <Card key={entry.version} className="border-dashed border-primary/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-base px-3 py-1">
                          v{entry.version}
                        </Badge>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">
                          <Rocket className="w-3 h-3 mr-1" />
                          Planejado
                        </Badge>
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">{entry.date}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {entry.changes.map((change, index) => (
                        <li key={index} className="flex items-start gap-3">
                          {getTypeBadge(change.type)}
                          <span className="text-sm">{change.description}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Versões Lançadas */}
          <div className="flex items-center gap-2 mt-8">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Versões Lançadas</h2>
          </div>
          {releasedEntries.map((entry) => (
            <Card key={entry.version}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      v{entry.version}
                    </Badge>
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">{entry.date}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {entry.changes.map((change, index) => (
                    <li key={index} className="flex items-start gap-3">
                      {getTypeBadge(change.type)}
                      <span className="text-sm">{change.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}