// Minimal layout for public-facing pages (no sidebar, no auth required)
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
