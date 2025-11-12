'use client'

import React from 'react'
import { TableCell } from '@/components/ui/table'

/**
 * Standardized Action Column wrapper for table rows
 * Ensures consistent spacing, alignment, and button grouping
 *
 * IMACX Design System v3.2 - Action Column Pattern:
 * - Flexbox layout with consistent gap spacing
 * - Centered alignment
 * - Standard width allocation
 *
 * Action button order (left to right):
 * 1. Edit/View button (choose one)
 * 2. Copy button (if supported)
 * 3. Delete button
 */

interface ActionColumnProps {
  children: React.ReactNode
  width?: string
  className?: string
}

export const ActionColumn: React.FC<ActionColumnProps> = ({
  children,
  width = 'w-[140px]',
  className = '',
}) => (
  <TableCell className={`${width} flex justify-center gap-2 pr-2 ${className}`}>
    {children}
  </TableCell>
)

export default ActionColumn
