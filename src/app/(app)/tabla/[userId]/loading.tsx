function SkeletonBar({ className }: { className?: string }) {
  return <div className={`shimmer ${className ?? ""}`} />;
}

export default function QuinielaAjenaLoading() {
  return (
    <div className="space-y-5 rise-in">
      {/* back link */}
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-24" />
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <SkeletonBar className="h-7 w-40 rounded-md" />
            <SkeletonBar className="h-3 w-28" />
          </div>
          <div className="space-y-1 text-right">
            <SkeletonBar className="ml-auto h-9 w-16 rounded-md" />
            <SkeletonBar className="ml-auto h-3 w-32" />
          </div>
        </div>
      </div>

      {/* advance hits */}
      <div className="rounded-xl border border-line bg-pitch-900 p-4 space-y-3">
        <SkeletonBar className="h-3 w-32" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <SkeletonBar className="h-3 w-28" />
            <SkeletonBar className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* locked predictions */}
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-40" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-pitch-900 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SkeletonBar className="h-3 w-20 rounded" />
              <SkeletonBar className="h-5 w-8 rounded-full" />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <SkeletonBar className="h-4 w-full rounded" />
              <SkeletonBar className="h-5 w-10 rounded" />
              <SkeletonBar className="h-4 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
