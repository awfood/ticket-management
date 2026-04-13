import { Skeleton } from '@/components/ui/skeleton'

export default function TicketsLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-48 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
