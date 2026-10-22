import type { Metadata } from "next";
import { GeoLocaleRoot } from "@/geo/locale-root";
import { t } from "@/geo/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GeoRuntimeBoundary } from "@/geo/authoring-preview/runtime-boundary";
import { GAID_STYLE_INIT_SCRIPT } from "@/geo/appearance/style-init";
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
      <head>
        {/* GeoAIDesk screen style (계측 default, 도폭 optional): applied before first paint so the page does not flash. */}
        <script dangerouslySetInnerHTML={{ __html: GAID_STYLE_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        {/* ThemeProvider stays outside GeoLocaleRoot: its inline theme script must be server-rendered. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <GeoLocaleRoot>
            <GeoRuntimeBoundary>
              <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
            </GeoRuntimeBoundary>
            <Toaster />
          </GeoLocaleRoot>
        </ThemeProvider>
      </body>
    </html>
  );
}
