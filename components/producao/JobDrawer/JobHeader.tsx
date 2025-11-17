"use client";

import { memo } from "react";
import type { Job } from "./types";

interface JobHeaderProps {
  job: Job;
}

/**
 * JobHeader Component
 * Displays job information header (ORC, FO, Campaign Name)
 */
function JobHeaderComponent({ job }: JobHeaderProps) {
  return (
    <div className="mb-6 p-4 uppercase">
      <div className="mb-2 flex items-center gap-8">
        <div>
          <div className="text-xs">ORC</div>
          <div className="font-mono">{job.numero_orc ?? "-"}</div>
        </div>
        <div>
          <div className="text-xs">FO</div>
          <div className="font-mono">{job.numero_fo}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs">Nome Campanha</div>
          <div className="truncate font-mono">{job.nome_campanha}</div>
        </div>
      </div>
    </div>
  );
}

export const JobHeader = memo(JobHeaderComponent);
