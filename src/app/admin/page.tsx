"use client";

import { useState, useEffect } from "react";
import { AdminLogin } from "@/components/admin/login";
import { AdminDashboard } from "@/components/admin/dashboard";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if already authenticated by trying to hit a protected endpoint
  useEffect(() => {
    fetch("/api/admin/import", { method: "HEAD" })
      .then((res) => {
        // If we don't get 401, we're authenticated
        // Actually, HEAD might not work. Just check cookie presence.
        setAuthenticated(document.cookie.includes("bazaar_admin_session"));
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return <AdminDashboard />;
}
