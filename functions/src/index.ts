import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

initializeApp()

const ADMINS_COLLECTION = 'admins'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Throws unless the caller is authenticated and already carries the
 * `admin: true` custom claim. The very first admin cannot be created
 * through this function (there is no admin yet to authorize it) — seed it
 * once via the Firebase Console (Authentication > user > "Set custom
 * claim") or `firebase auth:import` / the Admin SDK from a trusted machine,
 * documented in operations/firebase-hosting-runbook.md. */
function assertCallerIsAdmin(auth: { token?: Record<string, unknown> } | undefined): void {
  if (!auth || auth.token?.admin !== true) {
    throw new HttpsError('permission-denied', 'ต้องเป็น admin เพื่อจัดการสิทธิ์ผู้ดูแลระบบ')
  }
}

interface SetAdminRequest {
  email: string
}

/** Grants the `admin: true` custom claim to the Firebase Auth user matching
 * `email`, and mirrors the grant into Firestore's `admins` collection so
 * the admin panel can list current admins without needing a separate
 * "list all users" endpoint. Callable only by an existing admin. */
export const addAdminClaim = onCall<SetAdminRequest>(async (request) => {
  assertCallerIsAdmin(request.auth)

  const email = normalizeEmail(request.data.email ?? '')
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'กรุณาระบุอีเมลที่ถูกต้อง')
  }

  const auth = getAuth()
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    throw new HttpsError('not-found', `ไม่พบผู้ใช้ Firebase ที่มีอีเมล ${email} — ผู้ใช้ต้องเคย login ด้วย Google ก่อนอย่างน้อย 1 ครั้ง`)
  }

  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true })

  await getFirestore().collection(ADMINS_COLLECTION).doc(email).set({
    uid: user.uid,
    addedAt: FieldValue.serverTimestamp(),
    addedBy: request.auth?.token.email ?? 'unknown',
  })

  return { email, uid: user.uid }
})

/** Revokes the `admin: true` custom claim from the Firebase Auth user
 * matching `email`, and removes the Firestore mirror record. Callable only
 * by an existing admin. */
export const removeAdminClaim = onCall<SetAdminRequest>(async (request) => {
  assertCallerIsAdmin(request.auth)

  const email = normalizeEmail(request.data.email ?? '')
  if (!email) {
    throw new HttpsError('invalid-argument', 'กรุณาระบุอีเมลที่ถูกต้อง')
  }

  const auth = getAuth()
  try {
    const user = await auth.getUserByEmail(email)
    const { admin: _removed, ...remainingClaims } = user.customClaims ?? {}
    await auth.setCustomUserClaims(user.uid, remainingClaims)
  } catch (error) {
    // If the Firebase Auth user no longer exists, still clean up the
    // Firestore mirror below instead of leaving a dangling record.
    if (!(error instanceof Error) || !error.message.includes('no user record')) {
      throw error
    }
  }

  await getFirestore().collection(ADMINS_COLLECTION).doc(email).delete()

  return { email }
})
