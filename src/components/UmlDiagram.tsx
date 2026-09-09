import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, AlertTriangle, ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react'

interface UmlDiagramProps {
  diagram: string
  title?: string
  exportName?: string
}

let ensureMermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function ensureMermaid() {
  if (ensureMermaidPromise) return ensureMermaidPromise
  ensureMermaidPromise = import('mermaid').then((m) => {
    m.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      darkMode: true,
      securityLevel: 'loose',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
        nodeSpacing: 60,
        rankSpacing: 80,
      },
      themeVariables: {
        darkMode: true,
        background: '#1a1a2e',
        primaryColor: '#1a2744',
        primaryTextColor: '#93c5fd',
        primaryBorderColor: '#3b6fd4',
        lineColor: '#4a5568',
        secondaryColor: '#2d2d3d',
        tertiaryColor: '#252540',
        nodeBorder: '#3b6fd4',
        clusterBkg: '#1a1a2e',
        clusterBorder: '#4a4a6a',
        titleColor: '#e2e8f0',
        edgeLabelBackground: '#1a1a2e',
        subGraphTitleColor: '#a0a0c0',
      },
    })
    return m.default
  })
  return ensureMermaidPromise
}

let _idCounter = 0
function nextId() {
  return `mermaid_uml_${++_idCounter}_${Date.now()}`
}

export function UmlDiagram({ diagram, title = 'UML Architecture Diagram', exportName = 'architecture' }: UmlDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [diagramSize, setDiagramSize] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    let retries = 0

    async function render() {
      await Promise.resolve()
      if (cancelledRef.current) return
      setRendering(true)
      setError(null)
      setSvg(null)

      try {
        const mermaid = await ensureMermaid()
        const id = nextId()
        const { svg: rendered } = await mermaid.render(id, diagram)
        if (!cancelledRef.current) {
          setSvg(rendered)
          setRendering(false)
        }
      } catch {
        retries++
        if (retries < 2 && !cancelledRef.current) {
          try {
            const mermaid = await ensureMermaid()
            const simplified = simplifyDiagram(toAsciiDiagram(diagram))
            const id = nextId()
            const { svg: rendered } = await mermaid.render(id, simplified)
            if (!cancelledRef.current) {
              setSvg(rendered)
              setRendering(false)
            }
          } catch (err2) {
            if (!cancelledRef.current) {
              setError(err2 instanceof Error ? err2.message : 'Failed to render diagram')
              setRendering(false)
            }
          }
        } else if (!cancelledRef.current) {
          setError('Failed to render diagram')
          setRendering(false)
        }
      }
    }

    render()
    return () => { cancelledRef.current = true }
  }, [diagram])

  const fitDiagram = useCallback(() => {
    const viewport = viewportRef.current
    const svgEl = svgContainerRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!viewport || !svgEl) return

    const viewBox = svgEl.viewBox.baseVal
    const width = viewBox.width || svgEl.getBoundingClientRect().width || 800
    const height = viewBox.height || svgEl.getBoundingClientRect().height || 600
    const availableWidth = Math.max(viewport.clientWidth - 48, 1)
    const availableHeight = Math.max(viewport.clientHeight - 48, 1)

    svgEl.style.maxWidth = 'none'
    svgEl.style.width = `${width}px`
    svgEl.style.height = `${height}px`
    setDiagramSize({ width, height })
    setZoom(Math.min(3, Math.max(0.3, Math.min(availableWidth / width, availableHeight / height))))
  }, [])

  useEffect(() => {
    if (!svg) return
    const frame = requestAnimationFrame(fitDiagram)
    return () => cancelAnimationFrame(frame)
  }, [diagram, fitDiagram, svg])

  const zoomIn = () => setZoom((z) => Math.min(z + 0.2, 3))
  const zoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.3))

  const exportSvg = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportName}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Robust PNG export: serialize SVG with all styles inlined, render via Image
  const exportPng = async () => {
    if (!svg || !svgContainerRef.current) return
    const svgEl = svgContainerRef.current.querySelector('svg')
    if (!svgEl) return

    setExporting(true)
    try {
      // Clone so we can mutate safely
      const clone = svgEl.cloneNode(true) as SVGSVGElement

      // Use the tracked native (unscaled) diagram dimensions for the export canvas.
      // Fall back to viewBox dims, then to a safe minimum.
      const viewBoxW = svgEl.viewBox?.baseVal?.width ?? 0
      const viewBoxH = svgEl.viewBox?.baseVal?.height ?? 0
      const nativeW = diagramSize.width > 0 ? diagramSize.width : viewBoxW
      const nativeH = diagramSize.height > 0 ? diagramSize.height : viewBoxH
      const w = Math.max(nativeW, 800)
      const h = Math.max(nativeH, 600)
      clone.setAttribute('width', String(w))
      clone.setAttribute('height', String(h))

      // Inline a safe monospace font so the browser doesn't need to fetch it
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.textContent = `
        * { font-family: ui-monospace, "Courier New", monospace !important; }
        text { fill: #93c5fd; }
      `
      clone.insertBefore(styleEl, clone.firstChild)

      // Serialize to string
      const serialized = new XMLSerializer().serializeToString(clone)

      // Encode as a data URL (avoids CORS issues with blob URLs on some browsers)
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized)

      // Scale up large diagrams more aggressively so exports stay crisp
      const scale = w >= 2000 ? 3 : 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0d0d1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)

      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, w, h)
          resolve()
        }
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = dataUrl
      })

      const pngDataUrl = canvas.toDataURL('image/png', 1.0)
      const a = document.createElement('a')
      a.download = `${exportName}.png`
      a.href = pngDataUrl
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('PNG export failed:', err)
      // Fallback: export SVG instead
      exportSvg()
    } finally {
      setExporting(false)
    }
  }

  if (rendering) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
        <RefreshCw size={24} className="animate-spin text-blue-400" />
        <p className="text-sm">Rendering diagram…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/50 p-6">
        <AlertTriangle size={28} className="text-yellow-400/70" />
        <p className="text-sm font-medium text-white/60">Diagram rendering failed</p>
        <p className="text-xs text-white/30 text-center max-w-sm">{error}</p>
        <details className="text-xs text-white/20 mt-2 max-w-md">
          <summary className="cursor-pointer hover:text-white/40">Show diagram source</summary>
          <pre className="mt-2 p-3 bg-white/5 rounded text-[10px] overflow-auto max-h-40 text-left">
            {diagram}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 flex-shrink-0 bg-[#0F0F23]">
        <span className="text-xs text-white/40">{title}</span>
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button onClick={fitDiagram} className="px-2 py-1 rounded text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors text-xs font-mono" title="Fit diagram to screen">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={zoomIn} className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button onClick={fitDiagram} className="p-1.5 rounded text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors" title="Fit to screen">
            <Maximize2 size={14} />
          </button>
          <button
            onClick={exportSvg}
            className="flex items-center gap-1.5 text-xs bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 hover:text-white/90 px-2.5 py-1.5 rounded-md transition-colors ml-1"
            title="Export as SVG"
          >
            <Download size={12} />
            SVG
          </button>
          <button
            onClick={exportPng}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs bg-blue-600/80 hover:bg-blue-500/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-md transition-colors"
            title="Export as PNG"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {exporting ? 'Exporting…' : 'PNG'}
          </button>
        </div>
      </div>

      {/* Diagram canvas */}
      <div ref={viewportRef} className="flex-1 overflow-auto bg-[#0d0d1a] relative">
        <div
          className="flex min-w-full min-h-full items-center justify-center p-6"
        >
          <div
            className="flex-shrink-0"
            style={{ width: diagramSize.width * zoom, height: diagramSize.height * zoom }}
          >
            <div
              ref={svgContainerRef}
              style={{ width: diagramSize.width, height: diagramSize.height, transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.15s ease' }}
              dangerouslySetInnerHTML={{ __html: svg ?? '' }}
              className="uml-svg-container"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function simplifyDiagram(diagram: string): string {
  const lines = diagram.split('\n')
  const simplified: string[] = ['flowchart LR']
  const nodeLines = lines.filter(
    (l) => !l.includes('subgraph') && !l.includes('end') && !l.includes('classDef') && l.trim()
  )
  simplified.push(...nodeLines.slice(0, 30))
  return simplified.join('\n')
}

function toAsciiDiagram(diagram: string): string {
  return [...diagram].filter((char) => char.charCodeAt(0) <= 127).join('')
}
