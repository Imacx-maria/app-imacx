"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { Edit, Eye, Copy, Trash2, StickyNote, Plus } from "lucide-react";
import SimpleNotasPopover from "@/components/custom/SimpleNotasPopover";

/**
 * Standardized action button components for IMACX Design System v3.2
 * All buttons follow the design system specification:
 * - Yellow (default) for action buttons: Edit, View, Copy, Add, Notas
 * - Red (destructive) for Delete
 * - Outlined for utility buttons
 * - All have visible 1px imx-border (built into variants)
 * - Icon size: h-4 w-4
 * - Button size: h-10 w-10 (icon-only)
 */

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

/**
 * Edit Button - Opens editable form/drawer
 * Opens form where user CAN modify data
 */
const EditButtonInternal: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  title = "Editar",
  className = "",
}) => (
  <Button
    size="icon"
    variant="default"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={className}
  >
    <Edit className="h-4 w-4" />
  </Button>
);

export const EditButton = memo(EditButtonInternal);

/**
 * View Button - Opens read-only drawer/view
 * Opens drawer where user can ONLY view information
 */
const ViewButtonInternal = React.forwardRef<HTMLButtonElement, ActionButtonProps>(({
  onClick,
  disabled = false,
  title = "Ver detalhes",
  className = "",
}, ref) => (
  <Button
    ref={ref}
    size="icon"
    variant="default"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={className}
  >
    <Eye className="h-4 w-4" />
  </Button>
));
ViewButtonInternal.displayName = "ViewButtonInternal";

export const ViewButton = memo(ViewButtonInternal);

/**
 * Copy Button - Duplicates/copies an item
 * Yellow background, for duplication actions
 */
const CopyButtonInternal: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  title = "Duplicar",
  className = "",
}) => (
  <Button
    size="icon"
    variant="default"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={className}
  >
    <Copy className="h-4 w-4" />
  </Button>
);

export const CopyButton = memo(CopyButtonInternal);

/**
 * Delete Button - Removes/deletes an item
 * Red background for destructive actions
 */
const DeleteButtonInternal: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  title = "Eliminar",
  className = "",
}) => (
  <Button
    size="icon"
    variant="destructive"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={className}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
);

export const DeleteButton = memo(DeleteButtonInternal);

/**
 * Notas Button - Opens notes popup
 * Wrapper around SimpleNotasPopover for consistency
 */
interface NotasButtonProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const NotasButtonInternal: React.FC<NotasButtonProps> = ({
  value,
  onSave,
  disabled = false,
  title = "Notas",
  className = "",
}) => (
  <SimpleNotasPopover
    value={value}
    onSave={onSave}
    placeholder="Adicionar notas..."
    label={title}
    buttonSize="icon"
    disabled={disabled}
    className={className}
  />
);

export const NotasButton = memo(NotasButtonInternal);

/**
 * Add Button (Icon Only) - Adds a new item
 * Yellow background, icon-only (no text for table inline adds)
 */
const AddIconButtonInternal: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  title = "Adicionar",
  className = "",
}) => (
  <Button
    size="icon"
    variant="default"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={className}
  >
    <Plus className="h-4 w-4" />
  </Button>
);

export const AddIconButton = memo(AddIconButtonInternal);

/**
 * Add Button (With Text) - Adds a new section item
 * Yellow background, with text label (for section headers)
 */
interface AddButtonWithTextProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: "default" | "sm" | "lg" | "icon";
}

const AddButtonInternal: React.FC<AddButtonWithTextProps> = ({
  onClick,
  disabled = false,
  children,
  size = "default",
  ...props
}) => (
  <Button
    variant="default"
    onClick={onClick}
    disabled={disabled}
    size={size as any}
    {...props}
  >
    <Plus className="h-4 w-4 mr-2" />
    {children}
  </Button>
);

export const AddButton = memo(AddButtonInternal);

/**
 * Action Column Wrapper - Standardized table action column
 * Ensures consistent spacing, alignment, and button grouping
 *
 * IMACX Design System v3.2 - Action Column Pattern:
 * - Flexbox layout with consistent gap spacing
 * - Centered alignment
 * - Standard width allocation
 */
interface ActionColumnProps {
  children: React.ReactNode;
  width?: string;
  className?: string;
}

const ActionColumnInternal: React.FC<ActionColumnProps> = ({
  children,
  width = "w-[140px]",
  className = "",
}) => (
  <TableCell className={`${width} flex justify-center gap-2 pr-2 ${className}`}>
    {children}
  </TableCell>
);

export const ActionColumn = memo(ActionColumnInternal);
