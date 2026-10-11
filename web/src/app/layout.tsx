import type { Metadata } from "next";
import { GeoLocaleRoot } from "@/geo/locale-root";
import { t } from "@/geo/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ProjectProvider } from "@/lib/use-projects";
import { ApiTokenGate } from "@/components/api-token-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.header.productName", {}, "ko"),
  description: t("app.description", {}, "ko"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        {/* ThemeProvider stays outside GeoLocaleRoot: its inline theme script must be server-rendered. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <GeoLocaleRoot>
            <ProjectProvider>
              <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
            </ProjectProvider>
            <Toaster />
            <ApiTokenGate />
          </GeoLocaleRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
