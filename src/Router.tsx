import { useEffect, useState } from 'react'
import App, { type AppProps } from './App'
import { AdminApp } from './admin/AdminApp'
import { getBookletBySlug, type Booklet } from './lib/booklets'
import { isFirebaseConfigured } from './lib/firebase'
import defaultLocalPdfUrl from '../Booklet-web.pdf?url'

const FALLBACK_SLUG = 'riffai-booklet'

interface BookSource {
  id: string
  name: string
  url: string
  local: boolean
  createdAt: number
}

function bookletToBookSource(booklet: Booklet): BookSource {
  return {
    id: booklet.slug,
    name: booklet.name,
    url: booklet.pdfUrl,
    local: false,
    createdAt: booklet.createdAt?.toMillis() ?? 0,
  }
}

const localFallbackBook: BookSource = {
  id: FALLBACK_SLUG,
  name: 'RIFFAI Booklet',
  url: defaultLocalPdfUrl,
  local: false,
  createdAt: 0,
}

function ViewerLoadingScreen() {
  return (
    <div className="route-loading" role="status">
      <p>กำลังโหลดเอกสาร…</p>
    </div>
  )
}

function ViewerNotFoundScreen({ slug }: { slug: string }) {
  return (
    <div className="route-error" role="alert">
      <h1>ไม่พบเอกสาร</h1>
      <p>ไม่พบ booklet ที่มี slug &ldquo;{slug}&rdquo;</p>
      <a href="/">กลับหน้าแรก</a>
    </div>
  )
}

/** Resolves the booklet for a given slug, so the top-level router can decide
 * whether to render the viewer, a not-found screen, or (for "/") fall back
 * to the bundled local PDF when Firestore has no matching record yet. */
function BookletRoute({ slug, isRoot }: { slug: string; isRoot: boolean }) {
  const [state, setState] = useState<'loading' | 'ready' | 'not-found'>('loading')
  const [booklet, setBooklet] = useState<Booklet | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!isFirebaseConfigured) {
      // No Firebase project wired up yet — keep the legacy bundled PDF
      // working at the root path, and treat any /b/:slug as not-found
      // until an admin can publish real booklets.
      setState(isRoot ? 'ready' : 'not-found')
      return
    }

    setState('loading')
    void getBookletBySlug(slug)
      .then((result) => {
        if (cancelled) return
        if (result) {
          setBooklet(result)
          setState('ready')
        } else if (isRoot) {
          // No Firestore-backed booklet at the root path yet — keep the
          // legacy bundled PDF working until an admin publishes one.
          setState('ready')
        } else {
          setState('not-found')
        }
      })
      .catch(() => {
        if (cancelled) return
        // Firebase not configured / offline — fall back to the bundled PDF
        // only for the root path, otherwise show not-found.
        if (isRoot) setState('ready')
        else setState('not-found')
      })
    return () => {
      cancelled = true
    }
  }, [slug, isRoot])

  if (state === 'loading') return <ViewerLoadingScreen />
  if (state === 'not-found') return <ViewerNotFoundScreen slug={slug} />

  const primaryBook = booklet ? bookletToBookSource(booklet) : localFallbackBook
  const sharePath = isRoot && !booklet ? '/' : `/b/${slug}`
  const appProps: AppProps = { primaryBook, sharePath }
  return <App {...appProps} />
}

export function Router() {
  const path = window.location.pathname

  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />
  }

  const bookletMatch = path.match(/^\/b\/([^/]+)\/?$/)
  if (bookletMatch?.[1]) {
    return <BookletRoute slug={bookletMatch[1]} isRoot={false} />
  }

  return <BookletRoute slug={FALLBACK_SLUG} isRoot />
}
