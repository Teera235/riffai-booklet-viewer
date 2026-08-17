import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'

interface PdfPageProps {
  document: PDFDocumentProxy
  pageNumber: number
  maxWidth: number
  maxHeight: number
  zoom?: number
  thumbnail?: boolean
}

interface PageSize {
  width: number
  height: number
}

export function PdfPage({
  document,
  pageNumber,
  maxWidth,
  maxHeight,
  zoom = 1,
  thumbnail = false,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [size, setSize] = useState<PageSize>({ width: maxWidth, height: maxHeight })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      setStatus('loading')
      renderTaskRef.current?.cancel()

      try {
        const page = await document.getPage(pageNumber)
        if (cancelled) return

        const baseViewport = page.getViewport({ scale: 1 })
        const fitScale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height)
        const cssScale = Math.max(0.1, fitScale * zoom)
        const outputScale = thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: cssScale * outputScale })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d', { alpha: false })

        if (!canvas || !context || cancelled) return

        const cssWidth = viewport.width / outputScale
        const cssHeight = viewport.height / outputScale
        setSize({ width: cssWidth, height: cssHeight })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`

        const renderTask = page.render({ canvas, canvasContext: context, viewport })
        renderTaskRef.current = renderTask
        await renderTask.promise
        if (!cancelled) setStatus('ready')
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setStatus('error')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [document, maxHeight, maxWidth, pageNumber, thumbnail, zoom])

  return (
    <div
      className={`pdf-page ${thumbnail ? 'pdf-page--thumbnail' : ''} is-${status}`}
      style={{ width: size.width, height: size.height }}
      aria-label={`หน้า ${pageNumber}`}
    >
      <canvas ref={canvasRef} />
      {status === 'loading' && <div className="page-skeleton" aria-hidden="true" />}
      {status === 'error' && <div className="page-error">ไม่สามารถแสดงหน้านี้ได้</div>}
    </div>
  )
}
