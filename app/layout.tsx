import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "next-themes";

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
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}