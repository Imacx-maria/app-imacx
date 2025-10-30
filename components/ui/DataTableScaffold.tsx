"use client"

import * as React from "react"

type DataTableScaffoldProps = {
  title?: React.ReactNode
  filters?: React.ReactNode
  tabs?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function DataTableScaffold({
  title,
  filters,
  tabs,
  children,
  className,
}: DataTableScaffoldProps) {
  return (
    <div className={"imx-page-stack" + (className ? ` ${className}` : "")}> 
      {(title || filters || tabs) && (
        <div className="imx-section-stack">
          {title ? (
            typeof title === "string" ? (
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            ) : (
              title
            )
          ) : null}

          {filters ? (
            <div className="flex items-center gap-2">{filters}</div>
          ) : null}

          {tabs ? tabs : null}
        </div>
      )}

      <div className="imx-table-wrap">{children}</div>
    </div>
  )
}


