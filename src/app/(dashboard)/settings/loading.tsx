import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>

      {/* Settings cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
