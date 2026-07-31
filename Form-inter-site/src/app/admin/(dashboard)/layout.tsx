import { getCurrentAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-bordure pb-4">
        <AdminNav />
        <div className="flex items-center gap-3 text-sm text-texte-tenu">
          {admin && <span className="hidden sm:inline">{admin.email}</span>}
          <LogoutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
