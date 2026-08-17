import { useState } from 'react'
import type { User } from 'firebase/auth'
import { AdminManageBooklets } from './AdminManageBooklets'
import { AdminManageAccess } from './AdminManageAccess'

interface AdminShellProps {
  user: User
  onLogout: () => void
}

type Tab = 'booklets' | 'access'

export function AdminShell({ user, onLogout }: AdminShellProps) {
  const [tab, setTab] = useState<Tab>('booklets')

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <h1>RIFFAI Admin</h1>
        <div className="admin-topbar-actions">
          <span className="admin-user-email">{user.email}</span>
          <button type="button" className="admin-secondary-button" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === 'booklets' ? 'is-active' : ''}`}
          onClick={() => setTab('booklets')}
        >
          จัดการ Booklet
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'access' ? 'is-active' : ''}`}
          onClick={() => setTab('access')}
        >
          จัดการ Admin
        </button>
      </nav>

      {tab === 'booklets' ? <AdminManageBooklets /> : <AdminManageAccess currentUser={user} />}
    </div>
  )
}
