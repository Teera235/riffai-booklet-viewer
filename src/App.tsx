import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import logoLight from '../asset/LOGO_LIGHT_PNG.png'
import defaultBookUrl from '../Booklet-web.pdf?url'
import { Icon } from './components/Icon'
import { PdfPage } from './components/PdfPage'
import { PdfThumbnail } from './components/PdfThumbnail'
import {
  deleteStoredBook,
  listStoredBooks,
  saveStoredBook,
  type StoredBook,
} from './lib/bookLibrary'

GlobalWorkerOptions.workerSrc = pdfWorker

const MAX_FILE_SIZE = 250 * 1024 * 1024
const DEFAULT_BOOK_ID = 'riffai-booklet'

type ViewMode = 'single' | 'spread'
type TurnDirection = 'next' | 'previous'

interface BookSource {
  id: string
  name: string
  url: string
  local: boolean
  createdAt: number
}

interface ViewerSize {
  width: number
  height: number
}

const defaultBook: BookSource = {
  id: DEFAULT_BOOK_ID,
  name: 'RIFFAI Booklet',
  url: defaultBookUrl,
  local: false,
  createdAt: 0,
}

function initialPage(): number {
  const page = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isInteger(page) && page > 0 ? page : 1
}

function initialMode(): ViewMode {
  return new URLSearchParams(window.location.search).get('mode') === 'single' ? 'single' : 'spread'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function normalizePage(page: number, mode: ViewMode, total: number): number {
  const safePage = Math.min(Math.max(page, 1), total)
  if (mode === 'spread' && safePage > 1) return safePage % 2 === 0 ? safePage : safePage - 1
  return safePage
}

export default function App() {
  const viewerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const touchStartRef = useRef<number | null>(null)
  const [books, setBooks] = useState<BookSource[]>([defaultBook])
  const [activeBookId, setActiveBookId] = useState(DEFAULT_BOOK_ID)
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [direction, setDirection] = useState<TurnDirection>('next')
  const [zoom, setZoom] = useState(1)
  const [viewerSize, setViewerSize] = useState<ViewerSize>({ width: 1200, height: 760 })
  const [isCompact, setIsCompact] = useState(window.innerWidth < 820)
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')

  const activeBook = books.find((book) => book.id === activeBookId) ?? defaultBook
  const totalPages = pdfDocument?.numPages ?? 0
  const effectiveMode: ViewMode = isCompact ? 'single' : mode
  const visiblePages = useMemo(() => {
    if (!totalPages) return []
    const start = normalizePage(currentPage, effectiveMode, totalPages)
    if (effectiveMode === 'single' || start === 1 || start === totalPages) return [start]
    return [start, Math.min(start + 1, totalPages)]
  }, [currentPage, effectiveMode, totalPages])

  const canGoPrevious = currentPage > 1
  const canGoNext = totalPages > 0 && visiblePages.at(-1)! < totalPages
  const pageMaxWidth = effectiveMode === 'spread'
    ? Math.max(220, (viewerSize.width - 104) / 2)
    : Math.min(820, Math.max(240, viewerSize.width - 64))
  const pageMaxHeight = Math.max(280, viewerSize.height - 56)

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    if (!activeBook.local) {
      url.searchParams.set('page', String(currentPage))
      url.searchParams.set('mode', mode)
    }
    return url.toString()
  }, [activeBook.local, currentPage, mode])

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 820)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setViewerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(viewer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    void listStoredBooks()
      .then((storedBooks) => {
        if (disposed) return
        const localBooks = storedBooks.map((book) => {
          const url = URL.createObjectURL(book.blob)
          objectUrlsRef.current.push(url)
          return { id: book.id, name: book.name, url, local: true, createdAt: book.createdAt }
        })
        setBooks([defaultBook, ...localBooks])
      })
      .catch(() => setNotice('เบราว์เซอร์นี้ไม่รองรับการเก็บ PDF แบบถาวร'))

    return () => {
      disposed = true
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setPdfDocument(null)
    setLoadError('')
    setLoadingProgress(0)
    setCurrentPage(activeBook.id === DEFAULT_BOOK_ID ? initialPage() : 1)
    setZoom(1)

    const task = getDocument({ url: activeBook.url })
    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (!cancelled && total > 0) setLoadingProgress(Math.min(100, Math.round((loaded / total) * 100)))
    }
    void task.promise
      .then((loadedDocument) => {
        if (cancelled) return
        setPdfDocument(loadedDocument)
        setCurrentPage((page) => Math.min(page, loadedDocument.numPages))
        setLoadingProgress(100)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('PDF loading failed', error)
        const detail = error instanceof Error ? error.message : 'Unknown PDF loading error'
        setLoadError(`เปิดเอกสารไม่สำเร็จ (${detail})`)
      })

    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [activeBook.id, activeBook.url])

  useEffect(() => {
    if (activeBook.local || !totalPages) return
    const url = new URL(window.location.href)
    url.searchParams.set('page', String(currentPage))
    url.searchParams.set('mode', mode)
    window.history.replaceState(null, '', url)
  }, [activeBook.local, currentPage, mode, totalPages])

  useEffect(() => {
    if (!shareOpen) return
    let cancelled = false
    void QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#10110f', light: '#ffffff' },
    }).then((dataUrl) => {
      if (!cancelled) setQrCode(dataUrl)
    })
    return () => { cancelled = true }
  }, [shareOpen, shareUrl])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const goToPage = useCallback((page: number, turnDirection: TurnDirection) => {
    if (!totalPages) return
    setDirection(turnDirection)
    setCurrentPage(normalizePage(page, effectiveMode, totalPages))
  }, [effectiveMode, totalPages])

  const goPrevious = useCallback(() => {
    if (!canGoPrevious) return
    const target = effectiveMode === 'spread' && currentPage > 2 ? currentPage - 2 : currentPage - 1
    goToPage(target, 'previous')
  }, [canGoPrevious, currentPage, effectiveMode, goToPage])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    const target = effectiveMode === 'spread' ? (currentPage === 1 ? 2 : currentPage + 2) : currentPage + 1
    goToPage(target, 'next')
  }, [canGoNext, currentPage, effectiveMode, goToPage])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft') goPrevious()
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        goNext()
      }
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(2, value + 0.1))
      if (event.key === '-') setZoom((value) => Math.max(0.6, value - 0.1))
      if (event.key === 'Escape') {
        setShareOpen(false)
        setLibraryOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goNext, goPrevious])

  const changeMode = (nextMode: ViewMode) => {
    setMode(nextMode)
    setCurrentPage((page) => normalizePage(page, nextMode, totalPages || page))
    setZoom(1)
  }

  const selectThumbnail = (page: number) => {
    goToPage(page, page >= currentPage ? 'next' : 'previous')
    if (isCompact) setThumbnailsOpen(false)
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setNotice(`ไฟล์ใหญ่เกิน 250 MB (${formatFileSize(file.size)})`)
      return
    }
    const signature = await file.slice(0, 5).text()
    if (signature !== '%PDF-') {
      setNotice('กรุณาเลือกไฟล์ PDF ที่ถูกต้อง')
      return
    }

    const book: StoredBook = {
      id: crypto.randomUUID(),
      name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || 'Untitled.pdf',
      blob: file,
      createdAt: Date.now(),
    }

    try {
      await saveStoredBook(book)
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      const source: BookSource = { id: book.id, name: book.name, url, local: true, createdAt: book.createdAt }
      setBooks((current) => [current[0] ?? defaultBook, source, ...current.slice(1)])
      setActiveBookId(book.id)
      setLibraryOpen(false)
      setNotice('เพิ่ม PDF ลงในคลังแล้ว')
    } catch {
      setNotice('พื้นที่จัดเก็บไม่เพียงพอสำหรับไฟล์นี้')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeBook = async (book: BookSource) => {
    if (!book.local) return
    await deleteStoredBook(book.id)
    URL.revokeObjectURL(book.url)
    objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== book.url)
    setBooks((current) => current.filter((item) => item.id !== book.id))
    if (activeBookId === book.id) setActiveBookId(DEFAULT_BOOK_ID)
    setNotice('ลบ PDF ออกจากเครื่องแล้ว')
  }

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const nativeShare = async () => {
    if (!navigator.share) {
      await copyShareLink()
      return
    }
    try {
      await navigator.share({ title: activeBook.name, text: 'เปิดดู RIFFAI Booklet', url: shareUrl })
    } catch {
      // The share sheet can be intentionally dismissed.
    }
  }

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartRef.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const end = event.changedTouches[0]?.clientX ?? touchStartRef.current
    const distance = end - touchStartRef.current
    touchStartRef.current = null
    if (Math.abs(distance) < 55) return
    if (distance < 0) goNext()
    else goPrevious()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setLibraryOpen(true)} aria-label="เปิดคลังเอกสาร">
          <img src={logoLight} alt="RIFFAI" />
        </button>
        <button className="document-title" type="button" onClick={() => setLibraryOpen(true)}>
          <span>{activeBook.name.replace(/\.pdf$/i, '')}</span>
          <span className="document-meta">{totalPages ? `${totalPages} หน้า` : 'กำลังโหลด'}</span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button desktop-only" type="button" onClick={() => setThumbnailsOpen((open) => !open)} aria-label="ภาพย่อทุกหน้า" title="ภาพย่อทุกหน้า">
            <Icon name="menu" />
          </button>
          <button className="icon-button" type="button" onClick={() => setShareOpen(true)} aria-label="แชร์เอกสาร" title="แชร์เอกสาร">
            <Icon name="share" />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className={`thumbnail-rail ${thumbnailsOpen ? 'is-open' : ''}`} aria-label="ภาพย่อทุกหน้า">
          <div className="panel-heading">
            <div><strong>ทุกหน้า</strong><span>{totalPages} หน้า</span></div>
            <button className="icon-button" type="button" onClick={() => setThumbnailsOpen(false)} aria-label="ปิดภาพย่อ"><Icon name="close" /></button>
          </div>
          <div className="thumbnail-list">
            {pdfDocument && Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <PdfThumbnail
                key={page}
                document={pdfDocument}
                pageNumber={page}
                active={visiblePages.includes(page)}
                onSelect={selectThumbnail}
              />
            ))}
          </div>
        </aside>

        <div
          className="viewer"
          ref={viewerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="ambient-glow" aria-hidden="true" />
          {!pdfDocument && !loadError && (
            <div className="loading-state" role="status">
              <img src={logoLight} alt="" />
              <div className="loading-line"><span style={{ width: `${loadingProgress}%` }} /></div>
              <p>{loadingProgress > 0 ? `กำลังเปิดเอกสาร ${loadingProgress}%` : 'กำลังเตรียมเอกสาร'}</p>
            </div>
          )}
          {loadError && (
            <div className="error-state" role="alert">
              <strong>ไม่สามารถเปิดเอกสารได้</strong>
              <p>{loadError}</p>
              <button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()}>เลือก PDF อื่น</button>
            </div>
          )}
          {pdfDocument && (
            <div
              key={`${currentPage}-${effectiveMode}-${direction}`}
              className={`book-stage mode-${effectiveMode} turn-${direction}`}
              aria-live="polite"
            >
              {visiblePages.map((page, index) => (
                <div key={page} className={`page-wrap page-wrap--${index === 0 ? 'first' : 'second'}`}>
                  <PdfPage
                    document={pdfDocument}
                    pageNumber={page}
                    maxWidth={pageMaxWidth}
                    maxHeight={pageMaxHeight}
                    zoom={zoom}
                  />
                </div>
              ))}
              {effectiveMode === 'spread' && visiblePages.length === 2 && <span className="book-spine" aria-hidden="true" />}
            </div>
          )}
          <button className="edge-nav edge-nav--left" type="button" onClick={goPrevious} disabled={!canGoPrevious} aria-label="หน้าก่อนหน้า"><Icon name="chevron-left" size={26} /></button>
          <button className="edge-nav edge-nav--right" type="button" onClick={goNext} disabled={!canGoNext} aria-label="หน้าถัดไป"><Icon name="chevron-right" size={26} /></button>
        </div>
      </section>

      <footer className="toolbar" aria-label="เครื่องมืออ่านเอกสาร">
        <div className="toolbar-group mobile-only">
          <button className="tool-button" type="button" onClick={() => setThumbnailsOpen(true)} aria-label="ภาพย่อ"><Icon name="menu" /></button>
        </div>
        <div className="toolbar-group navigation-group">
          <button className="tool-button" type="button" onClick={goPrevious} disabled={!canGoPrevious} aria-label="หน้าก่อนหน้า"><Icon name="chevron-left" /></button>
          <label className="page-field">
            <span className="sr-only">หน้าปัจจุบัน</span>
            <input
              type="number"
              min={1}
              max={totalPages || 1}
              value={currentPage}
              onChange={(event) => goToPage(Number(event.target.value), Number(event.target.value) >= currentPage ? 'next' : 'previous')}
            />
            <span>/ {totalPages || '—'}</span>
          </label>
          <button className="tool-button" type="button" onClick={goNext} disabled={!canGoNext} aria-label="หน้าถัดไป"><Icon name="chevron-right" /></button>
        </div>
        <span className="toolbar-divider desktop-only" />
        <div className="toolbar-group desktop-only">
          <button className={`tool-button ${mode === 'single' ? 'is-active' : ''}`} type="button" onClick={() => changeMode('single')} aria-label="อ่านหน้าเดียว" title="อ่านหน้าเดียว"><Icon name="single-page" /></button>
          <button className={`tool-button ${mode === 'spread' ? 'is-active' : ''}`} type="button" onClick={() => changeMode('spread')} aria-label="อ่านสองหน้า" title="อ่านสองหน้า"><Icon name="spread" /></button>
        </div>
        <span className="toolbar-divider desktop-only" />
        <div className="toolbar-group zoom-group desktop-only">
          <button className="tool-button" type="button" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))} aria-label="ย่อ"><Icon name="minus" /></button>
          <button className="zoom-value" type="button" onClick={() => setZoom(1)} aria-label="พอดีหน้าจอ">{Math.round(zoom * 100)}%</button>
          <button className="tool-button" type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.1))} aria-label="ขยาย"><Icon name="plus" /></button>
        </div>
        <span className="toolbar-divider desktop-only" />
        <div className="toolbar-group action-group">
          <button className="tool-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="เพิ่ม PDF" title="เพิ่ม PDF"><Icon name="upload" /></button>
          <a className="tool-button desktop-only" href={activeBook.url} download={activeBook.name} aria-label="ดาวน์โหลด PDF" title="ดาวน์โหลด PDF"><Icon name="download" /></a>
          <button className="tool-button desktop-only" type="button" onClick={toggleFullscreen} aria-label="เต็มหน้าจอ" title="เต็มหน้าจอ"><Icon name="expand" /></button>
          <button className="tool-button mobile-only" type="button" onClick={() => setShareOpen(true)} aria-label="แชร์"><Icon name="share" /></button>
        </div>
      </footer>

      <input
        ref={fileInputRef}
        className="visually-hidden-input"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      {libraryOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false) }}>
          <section className="library-panel" role="dialog" aria-modal="true" aria-labelledby="library-title">
            <div className="modal-heading">
              <div><span className="eyebrow">DOCUMENTS</span><h2 id="library-title">คลังเอกสาร</h2></div>
              <button className="icon-button" type="button" onClick={() => setLibraryOpen(false)} aria-label="ปิด"><Icon name="close" /></button>
            </div>
            <div className="book-list">
              {books.map((book) => (
                <div key={book.id} className={`book-row ${book.id === activeBookId ? 'is-active' : ''}`}>
                  <button type="button" onClick={() => { setActiveBookId(book.id); setLibraryOpen(false) }}>
                    <span className="book-icon"><Icon name="single-page" /></span>
                    <span><strong>{book.name.replace(/\.pdf$/i, '')}</strong><small>{book.local ? 'เก็บอยู่ในอุปกรณ์นี้' : 'เอกสารหลัก • แชร์ได้'}</small></span>
                  </button>
                  {book.local && <button className="delete-button" type="button" onClick={() => void removeBook(book)} aria-label={`ลบ ${book.name}`}><Icon name="trash" size={18} /></button>}
                </div>
              ))}
            </div>
            <button className="upload-card" type="button" onClick={() => fileInputRef.current?.click()}>
              <span><Icon name="upload" size={22} /></span>
              <strong>เพิ่ม PDF เล่มใหม่</strong>
              <small>ไฟล์จะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น สูงสุด 250 MB</small>
            </button>
          </section>
        </div>
      )}

      {shareOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false) }}>
          <section className="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-title">
            <div className="modal-heading">
              <div><span className="eyebrow">SHARE BOOKLET</span><h2 id="share-title">แชร์ให้ลูกค้า</h2></div>
              <button className="icon-button" type="button" onClick={() => setShareOpen(false)} aria-label="ปิด"><Icon name="close" /></button>
            </div>
            <div className="qr-frame">{qrCode ? <img src={qrCode} alt={`QR code สำหรับ ${shareUrl}`} /> : <span className="qr-loading" />}</div>
            <p className="share-description">สแกน QR หรือส่งลิงก์นี้ให้ลูกค้า เปิดดูได้ทันทีบนมือถือและคอมพิวเตอร์</p>
            {activeBook.local && <p className="local-warning">PDF ที่เพิ่มจากเครื่องเป็นไฟล์ส่วนตัว ลิงก์จะเปิดกลับไปยังเอกสารหลัก</p>}
            <div className="share-link"><span>{shareUrl}</span><button type="button" onClick={() => void copyShareLink()}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button></div>
            <button className="primary-button share-button" type="button" onClick={() => void nativeShare()}><Icon name="share" /> แชร์ลิงก์</button>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
      <div className="sr-only" aria-live="polite">กำลังแสดงหน้า {visiblePages.join(' และ ')}</div>
    </main>
  )
}
