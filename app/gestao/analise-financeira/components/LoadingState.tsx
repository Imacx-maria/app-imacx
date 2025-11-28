"use client";

import { memo } from "react";
import { Card } from "@/components/ui/card";

function LoadingStateComponent() {
  return (
    <div className="w-full space-y-6 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-foreground">ANÁLISE FINANCEIRA</h1>
          <p className="text-muted-foreground mt-2">
            Dashboard executivo de análise financeira
          </p>
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-4 w-32 animate-pulse bg-muted rounded mb-4" />
            <div className="h-8 w-24 animate-pulse bg-muted rounded mb-2" />
            <div className="h-4 w-20 animate-pulse bg-muted rounded" />
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card className="p-6">
        <div className="h-6 w-48 animate-pulse bg-muted rounded mb-6" />
        <div className="h-64 animate-pulse bg-muted rounded" />
      </Card>

      {/* Table Skeleton */}
      <Card className="p-6">
        <div className="h-6 w-40 animate-pulse bg-muted rounded mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-5 w-32 animate-pulse bg-muted rounded" />
              <div className="h-5 w-24 animate-pulse bg-muted rounded" />
              <div className="h-5 w-24 animate-pulse bg-muted rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export const LoadingState = memo(LoadingStateComponent);
