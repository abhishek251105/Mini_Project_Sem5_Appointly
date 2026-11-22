import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardClient from "./_DashboardClient";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <DashboardClient />;
}
