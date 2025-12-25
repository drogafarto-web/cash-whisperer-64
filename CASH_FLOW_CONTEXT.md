# Sistema de Fluxo de Caixa - Documentação de Contexto

> **Propósito**: Este documento serve como referência para o modelo de dados e fluxos do sistema de caixa do laboratório. Use-o como contexto em futuras sessões de desenvolvimento.

---

## 1. Fluxo de Dados Atual

### 1.1 Entrada de Dados

O LIS exporta um arquivo de movimentação que é importado via `/import/daily-movement`.

A importação cria/atualiza:
- **`lis_closures`** - Fechamento de período LIS por unidade
- **`lis_closure_items`** - Uma linha por código LIS/atendimento

### 1.2 Estrutura do `lis_closure_items`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Identificador único |
| `closure_id` | uuid, FK | Referência para `lis_closures` (pode ser null) |
| `unit_id` | uuid, FK | Referência para `units` |
| `envelope_id` | uuid, FK | Referência para `cash_envelopes` (null até envelopamento) |
| `lis_code` | text | Código do atendimento no LIS |
| `patient_name` | text | Nome do paciente |
| `date` | date | Data do atendimento |
| `payment_method` | text | Método de pagamento (ver tabela abaixo) |
| `payment_status` | text | Status de resolução (ver tabela abaixo) |
| `amount` | numeric | Valor total do item |
| `cash_component` | numeric | Porção que vai para caixa físico |
| `receivable_component` | numeric | Porção faturada para convênios/governo |
| `gross_amount` | numeric | Valor bruto (cartão) |
| `net_amount` | numeric | Valor líquido após taxas (cartão) |
| `card_fee_value` | numeric | Valor da taxa do cartão |
| `card_fee_percent` | numeric | Percentual da taxa aplicada |
| `transaction_id` | uuid, FK | Referência para `transactions` (reconciliação futura) |
| `comprovante_status` | text | Status do comprovante (reconciliação futura) |

### 1.3 Mapeamento payment_method → payment_status

| payment_method | Status Inicial | Status Final Após Resolução | Fluxo de Resolução |
|----------------|----------------|-----------------------------|--------------------|
| `DINHEIRO` | `PENDENTE` | `FECHADO_EM_ENVELOPE` | Envelope físico + etiqueta |
| `PIX` | `PENDENTE` | `CONFIRMADO` | Confirmação lógica apenas |
| `CARTAO` | `PENDENTE` | `CONFIRMADO` | Confirmação lógica apenas |
| `BOLETO` | `PENDENTE` | *(futuro)* | A definir - contas a receber |
| `NAO_PAGO` | `PENDENTE` | *(futuro)* | A definir - cobrança |
| `CONVENIO` | `A_RECEBER` | `PAGO_POSTERIOR` | Faturamento para convênio |

### 1.4 Distinção Chave: FECHADO_EM_ENVELOPE vs CONFIRMADO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DISTINÇÃO DE STATUS FINAL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FECHADO_EM_ENVELOPE (apenas DINHEIRO)                                      │
│  ├── Envolve envelope físico                                                │
│  ├── Requer contagem de cédulas                                             │
│  ├── Gera etiqueta ZPL para impressão                                       │
│  ├── Cria registro em cash_envelopes                                        │
│  └── Define envelope_id no lis_closure_items                                │
│                                                                             │
│  CONFIRMADO (PIX e CARTÃO)                                                  │
│  ├── Confirmação lógica apenas                                              │
│  ├── NÃO cria envelope físico                                               │
│  ├── NÃO gera etiqueta                                                      │
│  ├── NÃO preenche envelope_id                                               │
│  └── Apenas atualiza payment_status                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fluxos de Resolução Atuais

Todos os fluxos partem do hub central `/cash-hub` ("Central Fechamento"), que exibe cards resumo para:
- **Dinheiro** - quantidade de códigos pendentes + total de `cash_component`
- **PIX** - quantidade de códigos pendentes + total de `amount`
- **Cartão** - quantidade de códigos pendentes + totais bruto, taxa, líquido

### 2.1 Dinheiro → Envelopes Físicos (FECHADO_EM_ENVELOPE)

**Página**: `/envelope-closing`

**Itens elegíveis**:
```sql
WHERE unit_id = :currentUserUnitId
  AND payment_method = 'DINHEIRO'
  AND cash_component > 0
  AND envelope_id IS NULL
```

**Fluxo**:
1. Atendente seleciona códigos LIS
2. Atendente conta dinheiro físico
3. Sistema calcula `expected_cash = SUM(cash_component)`
4. Se `counted == expected` (ou dentro da tolerância):
   - Cria registro em `cash_envelopes`
   - Atualiza `lis_closure_items`:
     - `payment_status = 'FECHADO_EM_ENVELOPE'`
     - `envelope_id = envelope.id`
5. Gera etiqueta única (ZPL ou PDF)
6. `label_printed_at` e `status` em `cash_envelopes` controlam reimpressões

### 2.2 PIX → Confirmação Lógica (CONFIRMADO)

**Página**: `/pix-closing`

**Itens elegíveis**:
```sql
WHERE unit_id = :currentUserUnitId
  AND payment_method = 'PIX'
  AND payment_status = 'PENDENTE'
```

**Fluxo**:
1. Atendente seleciona códigos PIX pendentes
2. Atendente confirma
3. Sistema atualiza `payment_status = 'CONFIRMADO'`

**Importante**: Não há envelope físico, não há etiqueta, apenas mudança de status.

### 2.3 Cartão → Confirmação Lógica com Visualização de Taxas (CONFIRMADO)

**Página**: `/card-closing`

**Itens elegíveis**:
```sql
WHERE unit_id = :currentUserUnitId
  AND payment_method = 'CARTAO'
  AND payment_status = 'PENDENTE'
```

**Fluxo**:
1. Atendente seleciona códigos de cartão pendentes
2. UI exibe totais:
   - **Bruto** (`SUM(gross_amount)` ou `SUM(amount)`)
   - **Taxa** (`SUM(card_fee_value)`)
   - **Líquido** (`SUM(net_amount)`)
3. Atendente confirma
4. Sistema atualiza `payment_status = 'CONFIRMADO'`

**Importante**: Não há envelope físico.

### 2.4 NAO_PAGO / BOLETO / CONVENIO

Atualmente permanecem como `payment_status = 'PENDENTE'` (ou `A_RECEBER` para convênio) e **não entram em nenhum fluxo de fechamento ainda**.

**Futuro**: Alimentarão fluxos de cobrança / contas a receber e/ou faturamento.

---

## 3. Diagrama de Relacionamentos

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│     units       │────<│  lis_closure_items  │>────│  lis_closures   │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                  │
                                  │ envelope_id (quando DINHEIRO)
                                  ▼
                        ┌─────────────────────┐
                        │   cash_envelopes    │
                        ├─────────────────────┤
                        │ id                  │
                        │ unit_id             │
                        │ lis_codes[]         │
                        │ lis_codes_count     │
                        │ expected_cash       │
                        │ counted_cash        │
                        │ difference          │
                        │ justificativa       │
                        │ status              │
                        │ label_printed_at    │
                        │ reprint_count       │
                        │ created_at          │
                        │ created_by          │
                        └─────────────────────┘
                                  │
                                  │ (futuro: reconciliação)
                                  ▼
                        ┌─────────────────────┐
                        │  bank_statements    │ (a criar)
                        │  bank_statement_    │
                        │  entries            │
                        └─────────────────────┘
```

---

## 4. Expectativas Futuras - Taxas e Conciliação Bancária

Em fases futuras, o sistema irá:

1. **Importar extratos bancários** (CSV de banco/adquirente) e tentar conciliar com `lis_closure_items` / `transactions`

2. **Usar** `gross_amount`, `net_amount`, `card_fee_value` e `payment_method` para:
   - Fazer match de lotes de cartão e liquidações PIX
   - Calcular taxas efetivas por adquirente, bandeira e perfil de parcelamento

### 4.1 Restrições e Ressalvas Importantes

| Aspecto | Consideração |
|---------|--------------|
| **Taxas mudam** | MDR de cartão e taxas PIX podem ser renegociadas; percentual fixo no código ficará obsoleto |
| **Diferenças de valor** | Haverá frequentemente pequenas diferenças entre valor esperado (taxa configurada na venda) e valor real (taxa aplicada pelo adquirente) |
| **Tolerância** | Matching deve usar thresholds de tolerância (absoluto e/ou percentual) ao invés de igualdade estrita |

### 4.2 Diretrizes de Design

O design deve:

1. **Permitir reconfiguração periódica** de tabelas de taxas (por adquirente, bandeira, débito/crédito, parcelas, período)

2. **Manter campos originais por item** (`gross_amount`, `card_fee_value`, `net_amount`) como verdade histórica do que foi esperado/registrado no momento

3. **Tolerar pequenas diferenças** ao tentar fazer match de itens LIS com entradas de extrato bancário

### 4.3 Preparação para Conciliação

Ao adicionar ou modificar estruturas de dados:

❌ **Evitar**:
- Assumir que taxas são fixas ou globalmente constantes
- Usar igualdade estrita para matching de valores

✅ **Preferir**:
- Design onde nova entidade "configuração de taxas" (ex: `card_fee_tables`) pode ser introduzida depois
- Lógica de matching que usa thresholds de tolerância
- Comentários indicando onde hooks de reconciliação serão plugados

---

## 5. Código de Referência

### 5.1 Serviço de Resolução de Pagamentos

Arquivo: `src/services/paymentResolutionService.ts`

```typescript
// Funções principais:
// - getAvailablePixItems(unitId) - busca PIX pendentes
// - getAvailableCardItems(unitId) - busca Cartão pendentes
// - resolvePaymentItems(itemIds, unitId, paymentMethod) - marca como CONFIRMADO
// - calculateCardTotals(items) - calcula bruto, taxa, líquido
// - getPendingPixCount/Total(unitId) - contagem e total PIX
// - getPendingCardCount/Totals(unitId) - contagem e totais Cartão
// - getPendingCashCount/Total(unitId) - contagem e total Dinheiro
```

### 5.2 Serviço de Envelope

Arquivo: `src/services/envelopeClosingService.ts`

```typescript
// Funções principais:
// - getAvailableItemsForEnvelope(unitId) - busca itens elegíveis
// - createEnvelopeWithItems(...) - cria envelope e atualiza itens
// - checkLabelPrinted(envelopeId) - verifica se etiqueta foi impressa
```

### 5.3 Hub Central

Arquivo: `src/pages/CashHub.tsx`

```typescript
// Exibe cards resumo para:
// - Dinheiro (pendentes sem envelope)
// - PIX (pendentes)
// - Cartão (pendentes com totais de taxa)
```

---

## 6. Checklist para Novas Implementações

Ao trabalhar com o sistema de caixa:

- [ ] Respeitar isolamento por `unit_id` em todas as queries
- [ ] Usar status correto: `FECHADO_EM_ENVELOPE` para dinheiro, `CONFIRMADO` para PIX/Cartão
- [ ] Não assumir taxas fixas - usar campos por item
- [ ] Documentar em comentários onde reconciliação futura plugará
- [ ] Manter compatibilidade com fluxos existentes
- [ ] Testar com múltiplas unidades

---

*Última atualização: Dezembro 2025*
