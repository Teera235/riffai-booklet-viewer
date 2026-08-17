import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { AdminLogin } from './AdminLogin'
import { AdminDashboard } from './AdminDashboard'
import '../admin.css'

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

export function AdminApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
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

  if (!isFirebaseConfigured) {
    return <AdminSetupNotice />
  }

  const handleLogin = async (email: string, password: string) => {
    setAuthError('')
    setSigningIn(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมล/รหัสผ่านอีกครั้ง'
          : 'เข้าสู่ระบบไม่สำเร็จ',
      )
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
    return <AdminLogin onSubmit={handleLogin} error={authError} submitting={signingIn} />
  }

  return <AdminDashboard user={user} onLogout={handleLogout} />
}
