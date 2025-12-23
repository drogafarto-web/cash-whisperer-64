/**
 * WebUSB service for Zebra label printers
 * Enables direct printing without drivers on Chrome/Edge browsers
 */

// WebUSB types for TypeScript
interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
  packetSize: number;
}

interface USBAlternateInterface {
  alternateSetting: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  interfaceName?: string;
  endpoints: USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
  alternates: USBAlternateInterface[];
  claimed: boolean;
}

interface USBConfiguration {
  configurationValue: number;
  configurationName?: string;
  interfaces: USBInterface[];
}

interface USBDevice {
  vendorId: number;
  productId: number;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
  deviceVersionMajor: number;
  deviceVersionMinor: number;
  deviceVersionSubminor: number;
  manufacturerName?: string;
  productName?: string;
  serialNumber?: string;
  configuration?: USBConfiguration;
  configurations: USBConfiguration[];
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  controlTransferIn(setup: object, length: number): Promise<USBInTransferResult>;
  controlTransferOut(setup: object, data?: BufferSource): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  isochronousTransferIn(endpointNumber: number, packetLengths: number[]): Promise<USBIsochronousInTransferResult>;
  isochronousTransferOut(endpointNumber: number, data: BufferSource, packetLengths: number[]): Promise<USBIsochronousOutTransferResult>;
  reset(): Promise<void>;
}

interface USBInTransferResult {
  data?: DataView;
  status: 'ok' | 'stall' | 'babble';
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: 'ok' | 'stall' | 'babble';
}

interface USBIsochronousInTransferResult {
  data?: DataView;
  packets: { bytesTransferred: number; status: 'ok' | 'stall' | 'babble' }[];
}

interface USBIsochronousOutTransferResult {
  packets: { bytesWritten: number; status: 'ok' | 'stall' | 'babble' }[];
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

declare global {
  interface Navigator {
    usb?: USB;
  }
}

// Zebra vendor IDs for USB detection
const ZEBRA_VENDOR_IDS = [0x0a5f, 0x0a5e]; // Common Zebra vendor IDs

export interface ZebraPrinterDevice {
  device: USBDevice;
  name: string;
  connected: boolean;
}

export interface PrinterStatus {
  connected: boolean;
  name: string | null;
  error: string | null;
}

let currentPrinter: ZebraPrinterDevice | null = null;

/**
 * Check if WebUSB is supported in the current browser
 */
export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Request access to a Zebra printer via WebUSB
 * Opens the browser's device picker dialog
 */
export async function requestPrinter(): Promise<ZebraPrinterDevice | null> {
  if (!isWebUSBSupported()) {
    throw new Error('WebUSB não é suportado neste navegador. Use Chrome ou Edge.');
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [
        ...ZEBRA_VENDOR_IDS.map(vendorId => ({ vendorId })),
        // Also allow any printer class device
        { classCode: 7 }, // Printer class
      ],
    });

    const printer: ZebraPrinterDevice = {
      device,
      name: device.productName || 'Impressora Zebra',
      connected: false,
    };

    return printer;
  } catch (error) {
    if ((error as Error).name === 'NotFoundError') {
      // User cancelled the picker
      return null;
    }
    throw error;
  }
}

/**
 * Connect to the selected printer
 */
export async function connectPrinter(printer: ZebraPrinterDevice): Promise<void> {
  try {
    await printer.device.open();
    
    if (printer.device.configuration === null) {
      await printer.device.selectConfiguration(1);
    }
    
    // Find the correct interface (usually the first one for printers)
    const interfaceNumber = printer.device.configuration?.interfaces?.[0]?.interfaceNumber ?? 0;
    await printer.device.claimInterface(interfaceNumber);
    
    printer.connected = true;
    currentPrinter = printer;
  } catch (error) {
    printer.connected = false;
    throw new Error(`Erro ao conectar à impressora: ${(error as Error).message}`);
  }
}

/**
 * Disconnect from the current printer
 */
export async function disconnectPrinter(): Promise<void> {
  if (currentPrinter?.device) {
    try {
      await currentPrinter.device.close();
    } catch (error) {
      console.warn('Erro ao desconectar impressora:', error);
    }
    currentPrinter.connected = false;
    currentPrinter = null;
  }
}

/**
 * Print ZPL content directly to the connected Zebra printer
 */
export async function printZpl(zplContent: string): Promise<boolean> {
  if (!currentPrinter?.connected) {
    throw new Error('Nenhuma impressora conectada');
  }

  try {
    // Convert ZPL string to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(zplContent);
    
    // Find the bulk OUT endpoint
    const configuration = currentPrinter.device.configuration;
    const interfaces = configuration?.interfaces || [];
    
    let endpointNumber = 1; // Default endpoint
    
    for (const iface of interfaces) {
      const alternate = iface.alternates?.[0];
      if (alternate) {
        for (const endpoint of alternate.endpoints) {
          if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
            endpointNumber = endpoint.endpointNumber;
            break;
          }
        }
      }
    }
    
    await currentPrinter.device.transferOut(endpointNumber, data);
    return true;
  } catch (error) {
    throw new Error(`Erro ao imprimir: ${(error as Error).message}`);
  }
}

/**
 * Get the current printer status
 */
export function getPrinterStatus(): PrinterStatus {
  return {
    connected: currentPrinter?.connected || false,
    name: currentPrinter?.name || null,
    error: null,
  };
}

/**
 * Get the current connected printer
 */
export function getCurrentPrinter(): ZebraPrinterDevice | null {
  return currentPrinter;
}

/**
 * Request, connect, and print in one step
 * Returns true if printed successfully, false if user cancelled or error
 */
export async function quickPrint(zplContent: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already connected
    if (currentPrinter?.connected) {
      await printZpl(zplContent);
      return { success: true };
    }

    // Request and connect
    const printer = await requestPrinter();
    if (!printer) {
      return { success: false, error: 'Seleção cancelada' };
    }

    await connectPrinter(printer);
    await printZpl(zplContent);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Check if we have any previously paired devices
 */
export async function getPairedDevices(): Promise<USBDevice[]> {
  if (!isWebUSBSupported()) {
    return [];
  }
  
  try {
    return await navigator.usb.getDevices();
  } catch {
    return [];
  }
}

/**
 * Attempt to reconnect to a previously paired device
 */
export async function reconnectToPairedDevice(): Promise<ZebraPrinterDevice | null> {
  const devices = await getPairedDevices();
  
  if (devices.length === 0) {
    return null;
  }

  // Try the first paired device
  const device = devices[0];
  const printer: ZebraPrinterDevice = {
    device,
    name: device.productName || 'Impressora Zebra',
    connected: false,
  };

  try {
    await connectPrinter(printer);
    return printer;
  } catch {
    return null;
  }
}
