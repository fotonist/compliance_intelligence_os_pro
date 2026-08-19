import "../globals.css";
import Sidebar from "../components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f6f8fc] text-[#102a43]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto bg-[#f6f8fc] p-6">
        {children}
      </main>
    </div>
  );
}
