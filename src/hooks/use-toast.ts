import { toast as sonnerToast } from 'sonner';

// Adapter to maintain backwards compatibility with the old toast API
// while using Sonner under the hood
interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

function toast({ title, description, variant }: ToastProps) {
  if (variant === 'destructive') {
    sonnerToast.error(title, { description });
  } else {
    sonnerToast.success(title, { description });
  }
}

function useToast() {
  return { toast };
}

export { useToast, toast };
