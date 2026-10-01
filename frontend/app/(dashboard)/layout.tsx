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
      <main className="relative min-w-0 flex-1 overflow-auto bg-[#f6f8fc] p-6">
        <div className="absolute right-6 top-6 z-40">
          <NotificationCenter />
        </div>
        {children}
      </main>
    </div>
  );
}
