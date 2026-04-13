import { Skeleton } from '@/components/ui/skeleton'

export default function ClientsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
