import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Skeleton className="h-12 w-3/4 max-w-2xl" />
        <Skeleton className="mt-6 h-6 w-1/2" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </main>
  );
}
