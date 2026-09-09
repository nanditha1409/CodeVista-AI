export function TreeSkeleton() {
  const items = [
    { depth: 0, width: '60%', isFolder: true },
    { depth: 1, width: '40%', isFolder: false },
    { depth: 1, width: '55%', isFolder: false },
    { depth: 1, width: '35%', isFolder: true },
    { depth: 2, width: '45%', isFolder: false },
    { depth: 2, width: '50%', isFolder: false },
    { depth: 0, width: '45%', isFolder: true },
    { depth: 1, width: '60%', isFolder: false },
    { depth: 1, width: '40%', isFolder: false },
    { depth: 0, width: '50%', isFolder: true },
    { depth: 1, width: '55%', isFolder: false },
    { depth: 1, width: '35%', isFolder: false },
    { depth: 1, width: '65%', isFolder: false },
  ]

  return (
    <div className="p-3 space-y-1.5 animate-pulse">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
          style={{ paddingLeft: `${item.depth * 20 + 8}px` }}
        >
          <div className="w-4 h-4 rounded bg-white/10 flex-shrink-0" />
          <div
            className="h-3 rounded bg-white/10"
            style={{ width: item.width }}
          />
        </div>
      ))}
    </div>
  )
}

export function CodeSkeleton() {
  const lines = [70, 50, 85, 40, 60, 90, 45, 75, 55, 80, 35, 65, 50, 70, 40]
  return (
    <div className="p-6 space-y-2 animate-pulse">
      {lines.map((w, i) => (
        <div
          key={i}
          className="h-3.5 rounded bg-white/8"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  )
}

export function PanelLoadingSkeleton() {
  return (
    <div className="h-full p-6 animate-pulse space-y-4">
      <div className="h-5 w-44 rounded bg-white/10" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-lg border border-white/8 bg-white/[0.03]" />)}
      </div>
      <div className="h-40 rounded-lg border border-white/8 bg-white/[0.03]" />
      <div className="h-24 rounded-lg border border-white/8 bg-white/[0.03]" />
    </div>
  )
}
