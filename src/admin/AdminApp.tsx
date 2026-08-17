import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
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
          บัญชี {email} ไม่มีสิทธิ์ผู้ดูแลระบบ กรุณาติดต่อ admin คนอื่นให้เพิ่มบัญชีนี้
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
  const [authError, setAuthError] = useState('')
  const [deniedEmail, setDeniedEmail] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    // Authorization is driven entirely by the Firebase Auth custom claim
    // `admin: true` (granted only through the addAdminClaim Cloud
    // Function) — not by any Firestore lookup. `getIdTokenResult(true)`
    // forces a token refresh so a claim granted moments ago (in another
    // tab, or by another admin) is picked up without requiring the user
    // to sign out and back in.
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null)
        setAuthReady(true)
        return
      }

      setAuthReady(false)
      try {
        const token = await nextUser.getIdTokenResult(true)
        if (token.claims.admin !== true) {
          setDeniedEmail(nextUser.email ?? '')
          await signOut(auth)
          setUser(null)
          return
        }
        setDeniedEmail('')
        setUser(nextUser)
      } catch {
        setAuthError('ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลระบบได้ กรุณาลองใหม่')
        setUser(null)
      } finally {
        setAuthReady(true)
      }
    })
    return unsubscribe
  }, [])

  if (!isFirebaseConfigured) {
    return <AdminSetupNotice />
  }

  const handleGoogleSignIn = async () => {
    setAuthError('')
    setDeniedEmail('')
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

  if (deniedEmail) {
    return <AdminAccessDenied email={deniedEmail} onLogout={() => setDeniedEmail('')} />
  }

  if (!user) {
    return <AdminLoginGate onSignIn={() => void handleGoogleSignIn()} error={authError} signingIn={signingIn} />
  }

  return <AdminShell user={user} onLogout={handleLogout} />
}
