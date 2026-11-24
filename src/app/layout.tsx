import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/misc";
import { APP_NAME } from "@/lib/brand";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Score handwritten AP essays row by row, with the teacher in control.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-center" toastOptions={{ className: "text-sm" }} />
      </body>
    </html>
  );
}
