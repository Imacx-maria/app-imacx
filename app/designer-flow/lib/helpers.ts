import type { Job } from "../types"

export const PRIORITY_COLORS = {
  red: "bg-destructive",
  blue: "bg-info",
  green: "bg-success",
} as const

export type PriorityColor = keyof typeof PRIORITY_COLORS

export const getPriorityColor = (job: Job): PriorityColor => {
  if (job.prioridade === true) return "red"

  if (job.created_at) {
    const days = (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 3) return "blue"
  }

  return "green"
}

export const parseNumericField = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  const strValue = String(value).trim()
  if (strValue === "") return 0
  const numValue = Number(strValue)
  return !Number.isNaN(numValue) ? numValue : 999_999 + strValue.charCodeAt(0)
}
