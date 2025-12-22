export interface ZplClosingData {
  unitName: string;
  unitCode: string;
  date: string;
  actualBalance: number;
  envelopeId: string;
  closedByName: string;
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
