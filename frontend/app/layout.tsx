import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="bg-[#f6f8fc] text-[#102a43]">
        {children}
      </body>
    </html>
  );
}