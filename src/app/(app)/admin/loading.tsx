function SkeletonBar({ className }: { className?: string }) {
  return <div className={`shimmer ${className ?? ""}`} />;
}

export default function AdminLoading() {
  return (
    <div className="space-y-4 rise-in">
      {/* Tab bar */}
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-28 rounded-lg" />
        <SkeletonBar className="h-8 w-24 rounded-lg" />
        <SkeletonBar className="h-8 w-24 rounded-lg" />
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-line bg-pitch-900 px-4 py-3">
            <div className="space-y-2">
              <SkeletonBar className="h-4 w-40" />
              <SkeletonBar className="h-3 w-24" />
            </div>
            <SkeletonBar className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
