"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedRoles = localStorage.getItem("roles");
    const roles = storedRoles ? JSON.parse(storedRoles) : [];

    // Token yok → login'e yönlendir
    if (!token) {
      router.push("/login");
      return;
    }

    // Admin değil → Matrix'e yönlendir
    if (!roles.includes("admin")) {
      router.push("/matrix");
      return;
    }
  }, [router]);

  return <>{children}</>;
}
