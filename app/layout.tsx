import "./globals.css";
import { Providers } from "@/components/Providers";
import { AuthProvider } from "@/components/AuthProvider";
import LayoutSwitcher from "@/components/LayoutSwitcher";

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
      <body className="min-h-screen bg-background">
        <Providers>
          <AuthProvider>
            <LayoutSwitcher>{children}</LayoutSwitcher>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
