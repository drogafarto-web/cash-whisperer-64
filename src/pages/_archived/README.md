# Arquivos Arquivados

Esta pasta contém páginas e componentes que foram temporariamente desativados para simplificar o sistema.

## Por que arquivar em vez de deletar?

1. **Preservação de código**: Todo código escrito pode ser útil no futuro
2. **Versionamento**: Mantém histórico completo no Git
3. **Reativação fácil**: Basta mover o arquivo de volta para `pages/`

## Como reativar uma página

1. Mova o arquivo de `_archived/` para `pages/`
2. Adicione a rota em `App.tsx`
3. Adicione o item no menu em `navigation.config.ts`

## Categorias de arquivos

### Fechamentos de Caixa (múltiplas variações)
- CashClosing.tsx
- CashClosingSimple.tsx
- EnvelopeCashClosing.tsx
- PixClosing.tsx
- CardClosing.tsx
- CashHub.tsx

### LIS (integração com sistema legado)
- lis/LisFechamento.tsx
- lis/CashClosingWithSelection.tsx

### Auditoria (funcionalidades avançadas)
- audit/ParticularVsCash.tsx
- audit/ConvenioVsInvoice.tsx

### Relatórios Avançados
- reports/TaxScenarios.tsx
- reports/PersonnelRealVsOfficial.tsx
- reports/Patrimony.tsx

### Configurações Avançadas
- settings/DataSeed2025.tsx
- settings/FatorRAudit.tsx
- settings/CardFeesConfig.tsx
- settings/AlertsConfig.tsx
