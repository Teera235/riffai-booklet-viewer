import { useEffect, useRef, useState } from 'react'
import {
  createBooklet,
  deleteBooklet,
  deleteBookletPdf,
  listBooklets,
  renameBooklet,
  slugExists,
  slugify,
  uploadBookletPdf,
  type Booklet,
} from '../lib/booklets'

const MAX_FILE_SIZE = 250 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AdminManageBooklets() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [booklets, setBooklets] = useState<Booklet[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [slugInput, setSlugInput] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const refreshList = async () => {
    setLoadingList(true)
    setListError('')
    try {
      const result = await listBooklets()
      setBooklets(result)
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'โหลดรายการ booklet ไม่สำเร็จ')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    void refreshList()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`ไฟล์ใหญ่เกิน 250 MB (${formatFileSize(file.size)})`)
      return
    }
    const signature = await file.slice(0, 5).text()
    if (signature !== '%PDF-') {
      setUploadError('กรุณาเลือกไฟล์ PDF ที่ถูกต้อง')
      return
    }
    setUploadError('')
    setPendingFile(file)
    const baseName = file.name.replace(/\.pdf$/i, '')
    setNameInput(baseName)
    setSlugInput(slugify(baseName))
    setSlugTouched(false)
  }

  const handlePublish = async () => {
    if (!pendingFile) return
    const trimmedName = nameInput.trim()
    const slug = slugify(slugTouched ? slugInput : nameInput)
    if (!trimmedName || !slug) {
      setUploadError('กรุณากรอกชื่อ booklet')
      return
    }
    setUploadError('')
    try {
      if (await slugExists(slug)) {
        setUploadError(`มี booklet ที่ใช้ลิงก์ "${slug}" อยู่แล้ว กรุณาเปลี่ยนลิงก์`)
        return
      }
      setUploadProgress(0)
      const { promise } = uploadBookletPdf(slug, pendingFile, setUploadProgress)
      const { pdfPath, pdfUrl } = await promise
      try {
        await createBooklet({ slug, name: trimmedName }, pdfPath, pdfUrl, pendingFile.size, null)
      } catch (error) {
        // Avoid leaving a publicly readable orphan when metadata creation
        // fails after Storage has accepted the PDF.
        await deleteBookletPdf(pdfPath).catch(() => undefined)
        throw error
      }
      setNotice('เผยแพร่ booklet สำเร็จแล้ว')
      setPendingFile(null)
      setNameInput('')
      setSlugInput('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refreshList()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadProgress(null)
    }
  }

  const cancelPending = () => {
    setPendingFile(null)
    setNameInput('')
    setSlugInput('')
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startRename = (booklet: Booklet) => {
    setRenamingSlug(booklet.slug)
    setRenameValue(booklet.name)
  }

  const submitRename = async (slug: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    setBusySlug(slug)
    try {
      await renameBooklet(slug, trimmed)
      setRenamingSlug(null)
      setNotice('เปลี่ยนชื่อสำเร็จแล้ว')
      await refreshList()
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'เปลี่ยนชื่อไม่สำเร็จ')
    } finally {
      setBusySlug(null)
    }
  }

  const handleDelete = async (booklet: Booklet) => {
    if (!window.confirm(`ลบ "${booklet.name}" ใช่ไหม? การลบไม่สามารถย้อนกลับได้`)) return
    setBusySlug(booklet.slug)
    try {
      await deleteBooklet(booklet)
      setNotice('ลบ booklet แล้ว')
      await refreshList()
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'ลบไม่สำเร็จ')
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <>
      <section className="admin-panel">
        <h2>เผยแพร่ booklet ใหม่</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => void handleFileSelect(event.target.files?.[0])}
        />
        {pendingFile && (
          <div className="admin-publish-form">
            <label className="admin-field">
              <span>ชื่อ booklet</span>
              <input
                type="text"
                value={nameInput}
                onChange={(event) => {
                  setNameInput(event.target.value)
                  if (!slugTouched) setSlugInput(slugify(event.target.value))
                }}
              />
            </label>
            <label className="admin-field">
              <span>ลิงก์ (slug)</span>
              <input
                type="text"
                value={slugInput}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlugInput(slugify(event.target.value))
                }}
              />
              <small>ลิงก์เปิดดู: /b/{slugInput || '…'}</small>
            </label>
            {uploadError && <p className="admin-error">{uploadError}</p>}
            {uploadProgress !== null && (
              <p className="admin-progress">กำลังอัปโหลด {uploadProgress}%</p>
            )}
            <div className="admin-publish-actions">
              <button type="button" className="admin-primary-button" onClick={() => void handlePublish()} disabled={uploadProgress !== null}>
                เผยแพร่
              </button>
              <button type="button" className="admin-secondary-button" onClick={cancelPending} disabled={uploadProgress !== null}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <h2>Booklet ทั้งหมด</h2>
        {listError && <p className="admin-error">{listError}</p>}
        {loadingList && <p>กำลังโหลด…</p>}
        {!loadingList && booklets.length === 0 && <p>ยังไม่มี booklet</p>}
        <ul className="admin-booklet-list">
          {booklets.map((booklet) => (
            <li key={booklet.id} className="admin-booklet-row">
              {renamingSlug === booklet.slug ? (
                <div className="admin-rename-form">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => void submitRename(booklet.slug)} disabled={busySlug === booklet.slug}>
                    บันทึก
                  </button>
                  <button type="button" onClick={() => setRenamingSlug(null)}>
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <>
                  <div className="admin-booklet-info">
                    <strong>{booklet.name}</strong>
                    <a href={`/b/${booklet.slug}`} target="_blank" rel="noreferrer">
                      /b/{booklet.slug}
                    </a>
                    <small>{formatFileSize(booklet.fileSize)}</small>
                  </div>
                  <div className="admin-booklet-actions">
                    <button type="button" onClick={() => startRename(booklet)} disabled={busySlug === booklet.slug}>
                      เปลี่ยนชื่อ
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      onClick={() => void handleDelete(booklet)}
                      disabled={busySlug === booklet.slug}
                    >
                      ลบ
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </>
  )
}
