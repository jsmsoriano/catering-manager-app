// app/components/Sidebar.tsx
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside style={{ width: 220, background: "#111", color: "#fff", padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Hibachi Ops</h2>
      <nav style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Link href="/dashboard" style={{ color: "white" }}>Dashboard</Link>
        <Link href="/bookings" style={{ color: "white" }}>Bookings</Link>
        <Link href="/rules" style={{ color: "white" }}>Money Rules</Link>
      </nav>
    </aside>
  );
}