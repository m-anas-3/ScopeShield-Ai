"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Menu, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/lib/actions/auth";
import type { Profile } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreditBadge } from "@/components/shared/CreditBadge";
import { Sidebar } from "@/components/dashboard/Sidebar";

interface TopBarProps {
  profile: Profile;
  email?: string;
}

function initials(profile: Profile, email?: string) {
  const source = profile.full_name ?? email ?? "ScopeShield";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TopBar({ profile, email }: TopBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const result = await signOutAction();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Signed out.");
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar className="w-full border-r-0" />
          </SheetContent>
        </Sheet>
        <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#534AB7] text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="font-semibold text-slate-950">ScopeShield AI</span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/projects/new">
            <Plus />
            New Project
          </Link>
        </Button>
        <CreditBadge credits={profile.credits_balance} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{initials(profile, email)}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Open account menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block text-sm">{profile.full_name ?? "Account"}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/usage">Usage and plan</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSignOut} disabled={isPending}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
