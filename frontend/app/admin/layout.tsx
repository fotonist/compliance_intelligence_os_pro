import Sidebar from "../components/Sidebar";
import NotificationCenter from "../components/NotificationCenter";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1, position: "relative" }}>
        <div className="absolute right-6 top-6 z-40">
          <NotificationCenter />
        </div>
        {children}
      </div>
    </div>
  );
}