"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

// TODO: replace with a real server-side session check (cookie/JWT) once
// admin auth exists — this client-side redirect works for the mock
// session but means an already-logged-in admin can briefly flash toward
// /admin/login before this effect corrects course to /admin/dashboard.
export default function AdminRootPage() {
  const router = useRouter();
  const { isLoggedIn } = useAdminAuth();

  useEffect(() => {
    router.replace(isLoggedIn ? "/admin/dashboard" : "/admin/login");
  }, [isLoggedIn, router]);

  return null;
}
