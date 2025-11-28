/**
 * Priority Helper Functions
 * Utility functions for priority color calculation
 */

import type { ProductionItem } from "../types";

/**
 * Get priority color for a production item
 * MUST match main producao page logic exactly
 *
 * RED: Priority explicitly set on main page
 * BLUE: Items older than 3 days
 * GREEN: Normal items (no priority, < 3 days old)
 */
export function getPriorityColor(item: ProductionItem): string {
  // RED: Priority explicitly set on main page
  if (item.folhas_obras?.prioridade === true) return "bg-destructive";

  // BLUE: Items older than 3 days
  if (item.created_at) {
    const days =
      (Date.now() - new Date(item.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days > 3) return "bg-info";
  }

  // GREEN: Normal items (no priority, < 3 days old)
  return "bg-success";
}

/**
 * Calculate stock quantity to deduct from paletes
 * Rounds UP fractional plates to whole numbers
 * Example: 20.5 plates → 21 plates deducted from stock
 */
export function calculateStockDeduction(
  plates: number | null | undefined
): number {
  if (!plates) return 0;
  return Math.ceil(plates);
}
