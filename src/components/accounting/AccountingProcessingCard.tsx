import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, FileText, Brain } from "lucide-react";

interface AccountingProcessingCardProps {
  onProcess: () => void;
}

export function AccountingProcessingCard({ onProcess }: AccountingProcessingCardProps) {
  return (
    <Card 
      className="bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 border-0 text-white shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
      onClick={onProcess}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="font-semibold text-lg tracking-wide">
                PROCESSAMENTO INTELIGENTE
              </span>
            </div>
            
            <div className="space-y-1">
              <p className="text-white/90 text-base font-medium">
                Arraste ou clique para processar magicamente
              </p>
              <p className="text-white/70 text-sm">
                Análise automática de guias DAS, FGTS, DARF, GPS, INSS, ISS
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Badge 
                variant="secondary" 
                className="bg-white/20 text-white border-0 hover:bg-white/30 gap-1"
              >
                <Brain className="h-3 w-3" />
                AI
              </Badge>
              <Badge 
                variant="secondary" 
                className="bg-white/20 text-white border-0 hover:bg-white/30 gap-1"
              >
                <FileText className="h-3 w-3" />
                PDF
              </Badge>
            </div>
          </div>

          <Button 
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1 group-hover:translate-x-1 transition-transform"
          >
            Processar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
