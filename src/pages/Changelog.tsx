import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { History, ArrowLeft, Plus, Bug, Sparkles } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'new' | 'fix' | 'improvement';
    description: string;
  }[];
}

const changelogEntries: ChangelogEntry[] = [
  {
    version: "1.0.0",
    date: "Dezembro 2024",
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

          {changelogEntries.map((entry) => (
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
