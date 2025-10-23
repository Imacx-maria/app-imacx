import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/providers/ThemeProvider"
import { PermissionsProvider } from "@/providers/PermissionsProvider"
import { LayoutWrapper } from "@/components/LayoutWrapper"

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "IMACX - Production Management",
  description: "Manufacturing and production management system",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PermissionsProvider>
            <LayoutWrapper>
              {children}
            </LayoutWrapper>
          </PermissionsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

