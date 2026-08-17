import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PdfPage } from './PdfPage'

interface PdfThumbnailProps {
  document: PDFDocumentProxy
  pageNumber: number
  active: boolean
  onSelect: (page: number) => void
}

export function PdfThumbnail({ document, pageNumber, active, onSelect }: PdfThumbnailProps) {
  const rootRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(pageNumber <= 4)

  useEffect(() => {
    const element = rootRef.current
    if (!element || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  return (
    <button
      ref={rootRef}
      className={`thumbnail ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={`ไปหน้า ${pageNumber}`}
    >
      <span className="thumbnail-page">
        {visible ? (
          <PdfPage document={document} pageNumber={pageNumber} maxWidth={108} maxHeight={154} thumbnail />
        ) : (
          <span className="thumbnail-placeholder" />
        )}
      </span>
      <span className="thumbnail-number">{pageNumber}</span>
    </button>
  )
}
