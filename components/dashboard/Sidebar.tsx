"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileSignature,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/change-requests", label: "Change Requests", icon: FileSignature },
  { href: "/usage", label: "Usage", icon: BarChart3 },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-gray-200 bg-white",
        className,
      )}
    >
      <Link href="/dashboard" className="flex h-16 items-center gap-2 px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold text-slate-950">
          ScopeShield AI
        </span>
      </Link>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-950",
                isActive && "bg-[#534AB7]/10 text-[#534AB7]",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-4 text-xs leading-5 text-muted-foreground">
        Protect scope, review risk, and track credits from one workspace.
      </div>
    </aside>
  );
}
