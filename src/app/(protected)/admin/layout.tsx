import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

/**
 * Ensures only users with the SUPER_ADMIN role can access the /admin routes.
 * Using getCurrentUser() matches (protected)/layout.tsx and prevents any
 * redirect ping-pong loops.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return children;
}
