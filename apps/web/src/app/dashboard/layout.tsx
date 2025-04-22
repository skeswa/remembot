import type React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const notionToken = cookieStore.get("notion_access_token");

  // Check if user is authenticated
  if (!notionToken) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-col md:flex-row flex-1">
        <aside className="w-full md:w-64 bg-gray-100 dark:bg-gray-800">
          <DashboardNav />
        </aside>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
