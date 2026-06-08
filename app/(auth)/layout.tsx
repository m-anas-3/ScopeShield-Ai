import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
        <Link href="/" className="flex w-fit items-center gap-2 py-8 text-slate-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">ScopeShield AI</span>
        </Link>
        <div className="flex flex-1 items-center justify-center pb-16">
          {children}
        </div>
      </div>
    </main>
  );
}
