import "./globals.css";
import Sidebar from "@/components/Sidebar";
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
      <body className="min-h-screen bg-[#f5f5f7] dark:bg-slate-950">
        <Providers>
          <div className="min-h-screen">
            <Sidebar />
            <main className="min-h-screen bg-[#f5f5f7] pt-16 pb-20 lg:ml-64 lg:pt-0 lg:pb-0 dark:bg-slate-950">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
