"use client"

import type { PriorityColor } from "@/app/designer-flow/lib/helpers"
import { PRIORITY_COLORS } from "@/app/designer-flow/lib/helpers"

interface PriorityIndicatorProps {
  currentPriority: PriorityColor
}

export const PriorityIndicator = ({ currentPriority }: PriorityIndicatorProps) => {
  const getTitle = () => {
    if (currentPriority === "red") return "Prioritário"
    if (currentPriority === "blue") return "Atenção"
    return "Normal"
  }

  return (
    <div
      className={`mx-auto flex h-3 w-3 items-center justify-center rounded-full ${PRIORITY_COLORS[currentPriority]}`}
      title={getTitle()}
    />
  )
}
