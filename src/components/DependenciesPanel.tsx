import { GitBranch, Cpu } from 'lucide-react'
import { useAnalysisStore } from '../stores/analysisStore'
import { DependencyGraph } from './DependencyGraph'
import { useFileStore } from '../stores/fileStore'
import { flattenTree } from '../lib/treeParser'
import type { DepNode } from '../lib/dependencyExtractor'
import { PanelLoadingSkeleton } from './LoadingSkeleton'

export function DependenciesPanel() {
  const depNodes = useAnalysisStore((s) => s.depNodes)
  const depEdges = useAnalysisStore((s) => s.depEdges)
  const analysisPhase = useAnalysisStore((s) => s.analysisPhase)
  const analysisError = useAnalysisStore((s) => s.analysisError)
  const selectFile = useFileStore((s) => s.selectFile)
  const tree = useFileStore((s) => s.tree)

  const handleNodeClick = (node: DepNode) => {
    if (!tree) return
    const allFiles = flattenTree(tree)
    const fileNode = allFiles.find((f) => f.path === node.id)
    if (fileNode) {
      selectFile(fileNode)
    }
  }

  if (analysisPhase === 'error' && analysisError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40 p-8">
        <p className="text-sm font-medium text-red-400/70">Analysis failed</p>
        <p className="text-xs text-white/30 text-center max-w-sm">{analysisError}</p>
      </div>
    )
  }

  if (depNodes.length === 0 && analysisPhase !== 'fetching' && analysisPhase !== 'parsing') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white/30 p-8">
        <GitBranch size={40} strokeWidth={1} className="text-white/20" />
        <div className="text-center">
          <p className="text-sm font-medium text-white/50 mb-1">Dependency graph not yet built</p>
          <p className="text-xs text-white/25">
            Click <span className="text-blue-400/70 font-mono">Analyze Architecture</span> to build an
            interactive import graph
          </p>
        </div>
      </div>
    )
  }

  if (depNodes.length === 0) {
    return (
      <div className="h-full relative">
        <PanelLoadingSkeleton />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/45">
          <Cpu size={24} className="animate-pulse text-blue-400/70" />
          <p className="text-sm">Building dependency graph…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <DependencyGraph nodes={depNodes} edges={depEdges} onNodeClick={handleNodeClick} />
    </div>
  )
}
