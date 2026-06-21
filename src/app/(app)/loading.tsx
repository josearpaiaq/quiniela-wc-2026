function SkeletonBar({ className }: { className?: string }) {
  return <div className={`shimmer ${className ?? ""}`} />;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-line bg-pitch-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-3 w-12" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <SkeletonBar className="h-6 w-6 rounded-full" />
          <SkeletonBar className="h-4 w-28" />
        </div>
        <SkeletonBar className="h-8 w-16 rounded-lg" />
        <div className="flex items-center gap-2 flex-1 justify-end">
          <SkeletonBar className="h-4 w-28" />
          <SkeletonBar className="h-6 w-6 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6 pt-2 rise-in">
      {/* Tab bar skeleton */}
      <div className="flex gap-2 overflow-hidden">
        <SkeletonBar className="h-8 w-24 rounded-full" />
        <SkeletonBar className="h-8 w-20 rounded-full" />
        <SkeletonBar className="h-8 w-20 rounded-full" />
        <SkeletonBar className="h-8 w-16 rounded-full" />
      </div>

      {/* Day strip skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <SkeletonBar key={i} className="h-14 w-20 shrink-0 rounded-xl" />
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-32" />
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
