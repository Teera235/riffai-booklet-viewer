import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { isAdminEmail } from '../lib/admins'
import { AdminShell } from './AdminShell'
import '../admin.css'

const googleProvider = new GoogleAuthProvider()

function AdminSetupNotice() {
  return (
    <div className="admin-shell admin-shell--center">
      <div className="admin-login-card">
        <h1>RIFFAI Admin</h1>
        <p className="admin-login-subtitle">
          ยังไม่ได้ตั้งค่า Firebase project สำหรับแอปนี้ กรุณาตั้งค่า environment variables
          (VITE_FIREBASE_*) ก่อนใช้งานหน้า admin
        </p>
      </div>
    </div>
  )
}

function AdminAccessDenied({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <div className="admin-shell admin-shell--center">
      <div className="admin-login-card">
        <h1>ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="admin-login-subtitle">
          บัญชี {email} ไม่ได้อยู่ในรายชื่อ admin กรุณาติดต่อผู้ดูแลระบบให้เพิ่มบัญชีนี้
        </p>
        <button type="button" className="admin-secondary-button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

function AdminLoginGate({ onSignIn, error, signingIn }: { onSignIn: () => void; error: string; signingIn: boolean }) {
  return (
    <div className="admin-shell admin-shell--center">
      <div className="admin-login-card">
        <h1>RIFFAI Admin</h1>
        <p className="admin-login-subtitle">เข้าสู่ระบบด้วยบัญชี Google เพื่อจัดการ booklet</p>
        {error && <p className="admin-error">{error}</p>}
        <button type="button" className="admin-primary-button" onClick={onSignIn} disabled={signingIn}>
          {signingIn ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>
      </div>
    </div>
  )
}

export function AdminApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user?.email) {
      setIsAdmin(null)
      return
    }
    let cancelled = false
    void isAdminEmail(user.email)
      .then((result) => {
        if (!cancelled) setIsAdmin(result)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.email])

  if (!isFirebaseConfigured) {
    return <AdminSetupNotice />
  }

  const handleGoogleSignIn = async () => {
    setAuthError('')
    setSigningIn(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setAuthError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSigningIn(false)
    }
  }

  const handleLogout = () => {
    void signOut(auth)
  }

  if (!authReady) {
    return (
      <div className="admin-shell admin-shell--center">
        <p>กำลังตรวจสอบสิทธิ์…</p>
      </div>
    )
  }

  if (!user) {
    return <AdminLoginGate onSignIn={() => void handleGoogleSignIn()} error={authError} signingIn={signingIn} />
  }

  if (isAdmin === null) {
    return (
      <div className="admin-shell admin-shell--center">
        <p>กำลังตรวจสอบสิทธิ์แอดมิน…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return <AdminAccessDenied email={user.email ?? ''} onLogout={handleLogout} />
  }

  return <AdminShell user={user} onLogout={handleLogout} />
}
