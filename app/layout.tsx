import "./globals.css";
import AppShell from "@/components/AppShell";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "Hibachi A Go Go - Catering Operations",
  description: "Catering Operations Dashboard",
  icons: {
    icon: '/hibachisun.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f5f5f7] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
