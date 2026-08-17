import { useState, type FormEvent } from 'react'

interface AdminLoginProps {
  onSubmit: (email: string, password: string) => void
  error: string
  submitting: boolean
}

export function AdminLogin({ onSubmit, error, submitting }: AdminLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password) return
    onSubmit(email, password)
  }

  return (
    <div className="admin-shell admin-shell--center">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>RIFFAI Admin</h1>
        <p className="admin-login-subtitle">เข้าสู่ระบบเพื่อจัดการ booklet</p>
        <label className="admin-field">
          <span>อีเมล</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="admin-field">
          <span>รหัสผ่าน</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" className="admin-primary-button" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
