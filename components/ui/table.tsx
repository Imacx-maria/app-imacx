import * as React from "react";

import { cn } from "@/lib/utils";

function getTextualContent(node: React.ReactNode): string | null {
  if (node === null || node === undefined || typeof node === "boolean")
    return null;
  if (typeof node === "number") return String(node);
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    const parts: string[] = [];
    for (const child of node) {
      const part = getTextualContent(child);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  }
  if (React.isValidElement(node)) {
    // Handles common patterns like <span>{26}</span> without trying to stringify complex nodes.
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getTextualContent(element.props.children);
  }
  return null;
}

function isProbablyNumericString(raw: string): boolean {
  let s = raw.replace(/\u00A0/g, " ").trim(); // NBSP -> space
  if (!s) return false;

  // Strip common currency symbols placed at start/end.
  s = s.replace(/^[\s]*[€$£¥]\s*/g, "");
  s = s.replace(/\s*[€$£¥]\s*$/g, "");
  s = s.trim();

  if (!/\d/.test(s)) return false;
  // Allow digits, whitespace, sign, parentheses, separators, and percent.
  return /^[\s()+\-.,%0-9]+$/.test(s);
}

function shouldRightAlignTableCell(children: React.ReactNode): boolean {
  if (typeof children === "number") return true;
  const text = getTextualContent(children);
  if (text === null) return false;
  return isProbablyNumericString(text);
}

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("imx-border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn(className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("imx-border-t bg-muted/50 font-medium", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "imx-border-b transition-colors data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, children, ...props }, ref) => {
  const isNumeric = shouldRightAlignTableCell(children);
  return (
    <td
      ref={ref}
      className={cn(
        "px-2 py-3 align-middle [&:has([role=checkbox])]:pr-0",
        className,
        isNumeric && "text-right tabular-nums",
      )}
      {...props}
    >
      {children}
    </td>
  );
});
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
