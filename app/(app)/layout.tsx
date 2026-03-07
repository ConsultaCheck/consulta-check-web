import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <div className="min-h-screen overflow-x-hidden lg:pl-64">
        <main className="min-w-0 px-4 pb-4 pt-14 md:px-6 md:pb-6 md:pt-14 lg:pt-8 lg:pb-8">{children}</main>
      </div>
    </>
  );
}

