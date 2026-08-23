"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isCompanyProfile =
    pathname === "/company/profile" ||
    pathname.startsWith("/company/profile/");

  const isCompanyProcesses =
    pathname === "/company/processes" ||
    pathname.startsWith("/company/processes/");

  const isCompanyOrganization =
    pathname === "/company/organization" ||
    pathname.startsWith("/company/organization/");

  const showCompanyFoundationHeader =
    isCompanyProfile ||
    isCompanyProcesses ||
    isCompanyOrganization;

  const tabClass = (href: string) =>
    `px-4 py-2 rounded-lg text-sm border ${
      pathname === href || pathname.startsWith(href + "/")
        ? "bg-slate-800 border-slate-700 text-slate-100"
        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60"
    }`;

  return (
    <div className="space-y-6">
      {showCompanyFoundationHeader && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">
                Company Foundation
              </div>

              <div className="text-sm text-slate-400">
                A Layer → Company Profile & Process Management
              </div>
            </div>
          </div>

        </>
      )}

      {children}
    </div>
  );
}