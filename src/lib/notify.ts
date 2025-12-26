import { toast } from 'sonner';

export type NotifyKind = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface NotifyOptions {
  title: string;
  description?: string;
  duration?: number;
}

// Função base centralizada
function base(kind: NotifyKind, { title, description, duration }: NotifyOptions) {
  const common = { description, duration };
  switch (kind) {
    case 'success':
      return toast.success(title, common);
    case 'error':
      return toast.error(title, common);
    case 'warning':
      return toast.warning(title, common);
    case 'info':
      return toast.info(title, common);
    default:
      return toast(title, common);
  }
}

// Funções semânticas exportadas
export function notifySuccess(title: string, description?: string, duration?: number) {
  return base('success', { title, description, duration });
}

export function notifyError(title: string, description?: string, duration?: number) {
  return base('error', { title, description, duration });
}

export function notifyWarning(title: string, description?: string, duration?: number) {
  return base('warning', { title, description, duration });
}

export function notifyInfo(title: string, description?: string, duration?: number) {
  return base('info', { title, description, duration });
}

// Fallback genérico para casos especiais
export function notify(options: NotifyOptions) {
  return base('default', options);
}
