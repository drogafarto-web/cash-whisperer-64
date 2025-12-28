# Testes Manuais - OCR Contábil Inteligente

## Como Rodar os Testes

1. Navegar para: **Painel Contabilidade** → **Enviar Documentos**
2. Selecionar uma unidade (Rio Pomba, Mercês ou Silveirânia)
3. Selecionar competência (mês/ano)
4. Usar abas **Notas Fiscais** ou **Despesas** para upload

---

## Caso 1: Receita (NFS-e LabClin → Convênio/Prefeitura)

### Cenário
Upload de PDF ou XML de NFS-e emitida por LabClin/filial para convênio ou prefeitura.

### Arquivo de Exemplo
- `NFS-e_PLASC_12-2025.pdf` (NFS-e LabClin Rio Pomba → PLASC)

### Resultados Esperados
- [ ] Classificação: `type = 'revenue'`
- [ ] Registro criado na tabela `invoices`
- [ ] Campos preenchidos:
  - `issuer_cnpj` = CNPJ da unidade LabClin
  - `customer_cnpj` = CNPJ do convênio/prefeitura
  - `customer_name` = Nome do tomador
  - `document_number` = Número da NF
  - `service_value` / `net_value` = Valores da nota
- [ ] Card `AccountingOcrResultCard` exibe:
  - Badge verde **"RECEITA"**
  - Mensagem de sucesso
  - Botão "Ver em Faturamento"
- [ ] Toast: "Receita cadastrada com sucesso"

---

## Caso 2: Despesa (Fornecedor → LabClin)

### Cenário
Upload de NF de compra ou boleto de fornecedor emitido para LabClin/filial.

### Arquivo de Exemplo
- Qualquer NF onde o tomador/destinatário seja LabClin (CNPJ 03.047.218/0001-90 ou filiais)

### Resultados Esperados
- [ ] Classificação: `type = 'expense'`
- [ ] Registro criado na tabela `payables`
- [ ] Campos preenchidos:
  - `beneficiario_cnpj` = CNPJ do fornecedor
  - `beneficiario` = Nome do fornecedor
  - `valor` = Valor total
  - `vencimento` = Data de vencimento (se houver)
- [ ] Card `AccountingOcrResultCard` exibe:
  - Badge vermelha **"DESPESA"**
  - Mensagem de sucesso
  - Botão "Ver em Contas a Pagar"
- [ ] Toast: "Despesa cadastrada com sucesso"

---

## Caso 3: Documento Não Fiscal / Classificação Incerta

### Cenário
Upload de documento genérico, scan ruim, ou imagem não fiscal.

### Arquivo de Exemplo
- Imagem de print de tela
- PDF de contrato sem valores fiscais
- Documento com CNPJs não reconhecidos

### Resultados Esperados
- [ ] Classificação: `type = 'unknown'`
- [ ] **Nenhum** registro criado em `invoices` nem `payables`
- [ ] Documento salvo apenas em `accounting_lab_documents`
- [ ] Card `AccountingOcrResultCard` exibe:
  - Badge âmbar **"REVISÃO MANUAL"**
  - Mensagem indicando necessidade de revisão
- [ ] Toast: "Documento requer classificação manual"

---

## Caso 4: Documento em Duplicidade

### Cenário
Subir o mesmo documento duas vezes (mesmo CNPJ emitente + número da nota).

### Passos
1. Fazer upload de uma NF válida
2. Aguardar processamento e confirmação de cadastro
3. Fazer upload do **mesmo arquivo** novamente

### Resultados Esperados
- [ ] **1ª vez**: Cria registro normalmente (invoice ou payable)
- [ ] **2ª vez**:
  - `isDuplicate = true`
  - **Nenhum** novo registro criado
  - Card exibe badge **"Documento já cadastrado"**
  - Botão para abrir registro existente
- [ ] Toast: "Documento já cadastrado anteriormente"

---

## Caso 5: XML de NF-e / NFS-e (Parse Estruturado)

### Cenário
Upload de arquivo `.xml` de NF-e (padrão SEFAZ) ou NFS-e (padrão ABRASF).

### Arquivo de Exemplo
- `nfe_123456.xml` (arquivo XML padrão de Nota Fiscal Eletrônica)

### Resultados Esperados
- [ ] **Parse estruturado** (sem OCR/IA) - processamento mais rápido
- [ ] Classificação correta baseada nos CNPJs do XML
- [ ] Campos extraídos com alta precisão:
  - CNPJ/Nome do emitente e destinatário
  - Número, série, data de emissão
  - Valores totais e impostos
- [ ] Confiança: 100% (parse direto, não estimativa de IA)
- [ ] Mesmo comportamento de criação de registro e UI

---

## CNPJs LabClin (Referência para Classificação)

| Unidade | CNPJ |
|---------|------|
| Matriz (Rio Pomba) | `03.047.218/0001-90` |
| Mercês | `03.047.218/0002-70` |
| Silveirânia | `60.239.141/0001-93` |

### Regra de Classificação

```
SE prestador.cnpj ∈ {CNPJs LabClin} E tomador.cnpj ∉ {CNPJs LabClin}
  → RECEITA

SE tomador.cnpj ∈ {CNPJs LabClin} E prestador.cnpj ∉ {CNPJs LabClin}
  → DESPESA

SENÃO → UNKNOWN (revisão manual)
```

---

## Formatos Suportados

| Formato | Método de Análise | Velocidade | Precisão |
|---------|-------------------|------------|----------|
| PDF | OCR com IA (Gemini) | 3-5 seg | ~95% |
| Imagem (JPG/PNG) | OCR com IA (Gemini) | 3-5 seg | ~90% |
| XML | Parse estruturado | <1 seg | ~100% |

---

## Troubleshooting

### Análise não inicia
- Verificar se o arquivo está nos formatos suportados
- Verificar se a unidade foi selecionada
- Checar console do navegador para erros

### Classificação incorreta
- Verificar se os CNPJs estão corretos na tabela `units`
- Confirmar que a regra prestador/tomador está sendo aplicada corretamente
- Checar logs da edge function para detalhes

### Duplicidade não detectada
- Verificar se `issuer_cnpj` e `document_number` coincidem exatamente
- Normalização de CNPJ (com/sem pontuação) pode afetar comparação

---

## Logs para Debug

### Edge Functions
- `analyze-accounting-document` - OCR de PDF/imagem
- `analyze-accounting-xml` - Parse de XML

### Tabelas Relevantes
- `invoices` - Receitas/Faturamento
- `payables` - Despesas/Contas a Pagar
- `accounting_lab_documents` - Documentos enviados
