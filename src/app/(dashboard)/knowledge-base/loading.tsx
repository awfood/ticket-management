import { Skeleton } from '@/components/ui/skeleton'

export default function KnowledgeBaseLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>

        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-96" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
