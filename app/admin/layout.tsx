import { AdminAuthProvider } from "@/contexts/AdminAuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <div data-theme="light" className="min-h-screen bg-bg text-text">
        {children}
      </div>
    </AdminAuthProvider>
  );
}
