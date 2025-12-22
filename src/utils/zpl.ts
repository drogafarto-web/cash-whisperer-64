export interface ZplClosingData {
  unitName: string;
  unitCode: string;
  date: string;
  actualBalance: number;
  envelopeId: string;
  closedByName: string;
}

export interface ZplEnvelopeData {
  unitName: string;
  unitCode: string;
  periodStart: string;
  periodEnd: string;
  cashTotal: number;
  lisCodes: string[];
  closedByName: string;
  closureId: string;
}

/**
 * Generates a ZPL string for Zebra label printers with cash closing data
 */
export function generateClosingZpl(data: ZplClosingData): string {
  const formattedBalance = data.actualBalance.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `^XA
^PW400
^LH10,10

^CF0,30
^FO20,20^FDLabclin - Fechamento Caixa^FS

^CF0,25
^FO20,60^FDUnidade: ${data.unitName.toUpperCase()}^FS
^FO20,90^FDData: ${data.date}^FS
^FO20,120^FDValor: R$ ${formattedBalance}^FS
^FO20,150^FDFechamento: ${data.envelopeId}^FS
^FO20,180^FDUsuario: ${data.closedByName.toUpperCase()}^FS

^BY2,2,60
^FO20,220
^BCN,60,Y,N,N
^FD${data.envelopeId}^FS
^XZ`;
}

/**
 * Generates a ZPL string for cash envelope label with LIS codes
 */
export function generateEnvelopeZpl(data: ZplEnvelopeData): string {
  const formattedTotal = data.cashTotal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Limitar códigos LIS para caber na etiqueta (máx 10, depois mostra "e mais X")
  const maxCodes = 10;
  const displayCodes = data.lisCodes.slice(0, maxCodes);
  const remainingCount = data.lisCodes.length - maxCodes;
  
  // Formatar lista de códigos
  let codesText = displayCodes.join(', ');
  if (remainingCount > 0) {
    codesText += ` (+${remainingCount})`;
  }

  // Quebrar códigos em múltiplas linhas se necessário
  const codeLines: string[] = [];
  const maxLineLength = 40;
  let currentLine = '';
  
  for (const code of displayCodes) {
    if ((currentLine + code).length > maxLineLength) {
      if (currentLine) codeLines.push(currentLine.trim());
      currentLine = code + ', ';
    } else {
      currentLine += code + ', ';
    }
  }
  if (currentLine) {
    codeLines.push(currentLine.replace(/, $/, ''));
  }
  if (remainingCount > 0) {
    codeLines.push(`... e mais ${remainingCount} códigos`);
  }

  // Construir ZPL com posicionamento dinâmico
  let yPos = 20;
  let zpl = `^XA
^PW600
^LH10,10

^CF0,35
^FO20,${yPos}^FDENVELOPE DE DINHEIRO^FS
`;
  yPos += 45;

  zpl += `
^CF0,25
^FO20,${yPos}^FDUnidade: ${data.unitName.toUpperCase()}^FS
`;
  yPos += 30;

  zpl += `^FO20,${yPos}^FDPeriodo: ${data.periodStart} a ${data.periodEnd}^FS
`;
  yPos += 35;

  zpl += `
^CF0,40
^FO20,${yPos}^FDTOTAL: R$ ${formattedTotal}^FS
`;
  yPos += 50;

  zpl += `
^CF0,20
^FO20,${yPos}^FDQtd codigos LIS: ${data.lisCodes.length}^FS
`;
  yPos += 25;

  // Adicionar linhas de códigos
  for (const line of codeLines) {
    zpl += `^FO20,${yPos}^FD${line}^FS
`;
    yPos += 22;
  }

  yPos += 10;
  zpl += `
^CF0,20
^FO20,${yPos}^FDResponsavel: ${data.closedByName.toUpperCase()}^FS
`;
  yPos += 35;

  // Código de barras do closure_id
  zpl += `
^BY2,2,50
^FO20,${yPos}
^BCN,50,Y,N,N
^FD${data.closureId.substring(0, 20)}^FS
^XZ`;

  return zpl;
}

/**
 * Generates envelope ID in the format: CODIGO-YYYY-MM-DD-NNN
 */
export function generateEnvelopeId(unitCode: string, date: string, sequence: number): string {
  const paddedSequence = String(sequence).padStart(3, '0');
  return `${unitCode}-${date}-${paddedSequence}`;
}

/**
 * Downloads ZPL content as a .zpl file
 */
export function downloadZplFile(zplContent: string, filename: string): void {
  const blob = new Blob([zplContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
