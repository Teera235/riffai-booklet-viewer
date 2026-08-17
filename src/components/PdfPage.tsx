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

const RENDER_TIMEOUT_MS = 15000

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
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      timedOut = true
      renderTaskRef.current?.cancel()
      setStatus('error')
    }, RENDER_TIMEOUT_MS)

    const render = async () => {
      setStatus('loading')
      renderTaskRef.current?.cancel()

      try {
        const page = await document.getPage(pageNumber)
        if (cancelled || timedOut) return

        const baseViewport = page.getViewport({ scale: 1 })
        const fitScale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height)
        const cssScale = Math.max(0.1, fitScale * zoom)
        const outputScale = thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: cssScale * outputScale })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d', { alpha: false })

        if (!canvas || !context || cancelled || timedOut) return

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
        if (!cancelled && !timedOut) {
          window.clearTimeout(timeoutId)
          setStatus('ready')
        }
      } catch (error) {
        if (!cancelled && !timedOut && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          window.clearTimeout(timeoutId)
          setStatus('error')
        }
      }
    }

    void render()
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      renderTaskRef.current?.cancel()
    }
  }, [document, maxHeight, maxWidth, pageNumber, thumbnail, zoom, retryToken])

  return (
    <div
      className={`pdf-page ${thumbnail ? 'pdf-page--thumbnail' : ''} is-${status}`}
      style={{ width: size.width, height: size.height }}
      aria-label={`หน้า ${pageNumber}`}
    >
      <canvas ref={canvasRef} />
      {status === 'loading' && <div className="page-skeleton" aria-hidden="true" />}
      {status === 'error' && (
        <div className="page-error">
          <p>ไม่สามารถแสดงหน้านี้ได้</p>
          {!thumbnail && (
            <button type="button" className="page-error-retry" onClick={() => setRetryToken((token) => token + 1)}>
              ลองใหม่
            </button>
          )}
        </div>
      )}
    </div>
  )
}
