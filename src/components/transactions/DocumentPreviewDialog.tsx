import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Document } from '@/types/database';
import { Sparkles } from 'lucide-react';

export interface DocumentPreviewDialogProps {
  selectedDocument: Document | null;
  documentPreviewUrl: string | null;
  onClose: () => void;
}

export function DocumentPreviewDialog({
  selectedDocument,
  documentPreviewUrl,
  onClose,
}: DocumentPreviewDialogProps) {
  return (
    <Dialog open={!!selectedDocument} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{selectedDocument?.file_name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          {documentPreviewUrl && (
            selectedDocument?.file_type.includes('pdf') ? (
              <iframe
                src={documentPreviewUrl}
                className="w-full h-[70vh] border rounded-lg"
              />
            ) : (
              <img
                src={documentPreviewUrl}
                alt={selectedDocument?.file_name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )
          )}
        </div>
        {selectedDocument?.ocr_data && !selectedDocument.ocr_data.error && (
          <div className="bg-accent/50 rounded-lg p-4 mt-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Dados extraídos via OCR
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {selectedDocument.ocr_data.valor && (
                <p>Valor: R$ {selectedDocument.ocr_data.valor}</p>
              )}
              {selectedDocument.ocr_data.data && (
                <p>Data: {selectedDocument.ocr_data.data}</p>
              )}
              {selectedDocument.ocr_data.fornecedor && (
                <p>Fornecedor: {selectedDocument.ocr_data.fornecedor}</p>
              )}
              {selectedDocument.ocr_data.confianca && (
                <p>Confiança: {selectedDocument.ocr_data.confianca}%</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
