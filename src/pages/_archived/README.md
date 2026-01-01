# Arquivos Arquivados

Esta pasta contém páginas e componentes que foram temporariamente desativados para simplificar o sistema.

## Estrutura de Arquivamento

### Arquivos de Página
Páginas arquivadas permanecem em suas pastas originais dentro de `src/pages/`.

### Rotas Arquivadas
Todas as rotas arquivadas estão consolidadas em:
```
src/routes/archived.routes.ts
```

Este arquivo contém:
- Imports comentados de todas as páginas arquivadas
- Rotas comentadas correspondentes
- Instruções de reativação

## Por que arquivar em vez de deletar?

1. **Preservação de código**: Todo código escrito pode ser útil no futuro
2. **Versionamento**: Mantém histórico completo no Git
3. **Reativação fácil**: Processo documentado e simples

## Como reativar uma página

1. Abra `src/routes/archived.routes.ts`
2. Encontre o import e a rota desejados
3. Descomente ambos
4. Mova para `src/App.tsx` na seção apropriada
5. Adicione o item no menu em `src/components/layout/navigation.config.ts`

## Categorias de arquivos

### Fechamentos de Caixa (múltiplas variações)
- `CashClosing.tsx`
- `CashClosingSimple.tsx`
- `EnvelopeCashClosing.tsx`
- `PixClosing.tsx`
- `CardClosing.tsx`
- `CashHub.tsx`

### LIS (integração com sistema legado)
- `lis/LisFechamento.tsx`
- `lis/CashClosingWithSelection.tsx`

### Auditoria (funcionalidades avançadas)
- `audit/ParticularVsCash.tsx`
- `audit/ConvenioVsInvoice.tsx`

### Relatórios Avançados
- `reports/TaxScenarios.tsx`
- `reports/PersonnelRealVsOfficial.tsx`
- `reports/Patrimony.tsx`

### Configurações Avançadas
- `settings/DataSeed2025.tsx`
- `settings/FatorRAudit.tsx`
- `settings/CardFeesConfig.tsx`
- `settings/AlertsConfig.tsx`
- `settings/FiscalBase.tsx`
- `settings/Partners.tsx`
- `settings/TaxConfig.tsx`
- `settings/Convenios.tsx`
