import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Hibachi Ops",
  description: "Catering Operations Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          
          {/* Sidebar */}
          <div
            style={{
              width: 220,
              background: "#111",
              color: "white",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Hibachi Ops</h2>
            <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/dashboard" style={{ color: "white" }}>
                Dashboard
              </Link>
              <Link href="/bookings" style={{ color: "white" }}>
                Bookings
              </Link>
              <Link href="/rules" style={{ color: "white" }}>
                Money Rules
              </Link>
            </nav>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, padding: 40 }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}