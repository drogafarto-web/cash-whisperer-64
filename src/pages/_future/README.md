# Funcionalidades Futuras

Esta pasta contém páginas que serão ativadas após o núcleo do sistema estar 100% funcional.

## Critério para ativação

Uma página só deve sair de `_future/` quando:
1. O fluxo principal (Receita → Despesa → Impostos → Lucro) estiver funcionando
2. A funcionalidade tiver sido testada em ambiente de desenvolvimento
3. Houver demanda real do usuário

## Páginas pendentes de ativação

### Recepção
- ReceptionPanel.tsx - Painel simplificado para atendentes

### Importação
- import/BankStatement.tsx - Importação de extrato bancário OFX/CSV
- import/ConvenioReports.tsx - Importação de relatórios de convênios

### Relatórios
- reports/CashClosingReport.tsx - Relatório de fechamentos
- reports/CashflowProjection.tsx - Projeção de fluxo de caixa
- reports/LisClosuresReport.tsx - Relatório de fechamentos LIS

### Conciliação
- payables/Reconciliation.tsx - Conciliação bancária automática

### Pendências
- Pendencias.tsx - Dashboard de pendências
