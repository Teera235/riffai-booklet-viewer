import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { addAdmin, listAdmins, removeAdmin, type AdminEntry } from '../lib/admins'

interface AdminManageAccessProps {
  currentUser: User
}

export function AdminManageAccess({ currentUser }: AdminManageAccessProps) {
  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const refreshList = async () => {
    setLoading(true)
    setListError('')
    try {
      const result = await listAdmins()
      setAdmins(result)
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'โหลดรายชื่อ admin ไม่สำเร็จ')
    } finally {
      setLoading(false)
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

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setAddError('กรุณากรอกอีเมลที่ถูกต้อง')
      return
    }
    setAddError('')
    setAdding(true)
    try {
      await addAdmin(trimmed, currentUser.email ?? 'unknown')
      setEmailInput('')
      setNotice('เพิ่ม admin แล้ว')
      await refreshList()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'เพิ่ม admin ไม่สำเร็จ')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (email: string) => {
    if (email === currentUser.email?.toLowerCase()) {
      if (!window.confirm('คุณกำลังลบสิทธิ์ admin ของตัวเอง จะไม่สามารถเข้าหน้านี้ได้อีก ยืนยันไหม?')) return
    } else if (!window.confirm(`ลบสิทธิ์ admin ของ ${email} ใช่ไหม?`)) {
      return
    }
    setBusyEmail(email)
    try {
      await removeAdmin(email)
      setNotice('ลบ admin แล้ว')
      await refreshList()
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'ลบ admin ไม่สำเร็จ')
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <>
      <section className="admin-panel">
        <h2>เพิ่ม admin ใหม่</h2>
        <form className="admin-add-admin-form" onSubmit={(event) => void handleAdd(event)}>
          <label className="admin-field">
            <span>อีเมล Google ของ admin</span>
            <input
              type="email"
              placeholder="name@example.com"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
          </label>
          {addError && <p className="admin-error">{addError}</p>}
          <button type="submit" className="admin-primary-button" disabled={adding}>
            {adding ? 'กำลังเพิ่ม…' : 'เพิ่ม admin'}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>รายชื่อ admin ทั้งหมด</h2>
        {listError && <p className="admin-error">{listError}</p>}
        {loading && <p>กำลังโหลด…</p>}
        {!loading && admins.length === 0 && <p>ยังไม่มี admin ในระบบ</p>}
        <ul className="admin-booklet-list">
          {admins.map((admin) => (
            <li key={admin.email} className="admin-booklet-row">
              <div className="admin-booklet-info">
                <strong>{admin.email}</strong>
                {admin.email === currentUser.email?.toLowerCase() && <small>คุณ</small>}
              </div>
              <div className="admin-booklet-actions">
                <button
                  type="button"
                  className="admin-danger-button"
                  onClick={() => void handleRemove(admin.email)}
                  disabled={busyEmail === admin.email}
                >
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </>
  )
}
