import "../globals.css";
import Sidebar from "../components/Sidebar";
import NotificationCenter from "../components/NotificationCenter";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f6f8fc] text-[#102a43]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-[52px] shrink-0 items-center justify-end border-b border-slate-200 bg-white px-6">
          <NotificationCenter />
        </header>

        <main className="min-w-0 flex-1 overflow-auto bg-[#f6f8fc] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
