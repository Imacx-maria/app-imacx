import * as React from "react";
import { Trash2, Pencil, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  size?: number;
}

// Delete Button - Red background with white text
export const DeleteButton = React.forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ onClick, disabled, className, size = 16 }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 min-w-8 flex-shrink-0 items-center justify-center rounded-full",
        "bg-destructive text-destructive-foreground",
        "imx-border ",
        "hover:bg-destructive/90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className,
      )}
      title="Delete"
    >
      <Trash2 size={size} />
    </button>
  );
});
DeleteButton.displayName = "DeleteButton";

// Edit Button - Accent background with accent foreground
export const EditButton = React.forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ onClick, disabled, className, size = 16 }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 min-w-8 flex-shrink-0 items-center justify-center rounded-full",
        "bg-accent text-accent-foreground",
        "imx-border ",
        "hover:bg-accent/80",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className,
      )}
      title="Edit"
    >
      <Pencil size={size} className="text-accent-foreground" />
    </button>
  );
});
EditButton.displayName = "EditButton";

// View Button - Primary (yellow/orange) with primary foreground
export const ViewButton = React.forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(({ onClick, disabled, className, size = 16 }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 min-w-8 flex-shrink-0 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground",
        "imx-border ",
        "hover:bg-primary/90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className,
      )}
      title="View"
    >
      <Eye size={size} className="text-primary-foreground" />
    </button>
  );
});
ViewButton.displayName = "ViewButton";

// Text Button Variants
interface TextButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "delete" | "edit" | "view";
}

export const TextButton = React.forwardRef<HTMLButtonElement, TextButtonProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    const variantStyles = {
      delete:
        "bg-destructive text-destructive-foreground imx-border  hover:bg-destructive/90",
      edit: "bg-accent text-accent-foreground imx-border  hover:bg-accent/80",
      view: "bg-primary text-primary-foreground imx-border  hover:bg-primary/90",
      default:
        "bg-background text-foreground imx-border  hover:bg-accent hover:text-accent-foreground",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center",
          "px-4 py-2 text-sm font-medium uppercase",
          "transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
TextButton.displayName = "TextButton";
