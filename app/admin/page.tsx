import { redirect } from "next/navigation";

/**
 * Admin root entry point (Task 12.5)
 *
 * Middleware handles route authorization server-side, redirecting unauthenticated
 * visitors to /admin/login and authenticated staff to /admin/dashboard.
 * If this page component is invoked directly, perform an immediate server-side
 * redirect to /admin/dashboard without client-side rendering or layout flash.
 */
export default function AdminRootPage() {
  redirect("/admin/dashboard");
}
