"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorStateComponent({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
          <p className="text-muted-foreground mt-2">
            Dashboard executivo de análise financeira
          </p>
        </div>
      </div>
      <Card className="p-6">
        <div className="text-center">
          <p className="text-foreground mb-4">Erro ao carregar dados: {error}</p>
          <Button variant="default" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const ErrorState = memo(ErrorStateComponent);
