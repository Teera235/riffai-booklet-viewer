import { httpsCallable } from 'firebase/functions'
import {
  collection,
  getDocs,
  type Timestamp,
} from 'firebase/firestore'
import { db, functions } from './firebase'

export interface AdminEntry {
  email: string
  uid: string | null
  addedAt: Timestamp | null
  addedBy: string | null
}

/** Lists the admins mirror written by the addAdminClaim/removeAdminClaim
 * Cloud Functions. This is a read-only reflection of who currently holds
 * the `admin: true` custom claim — the claim itself, not this collection,
 * is what actually grants access. */
export async function listAdmins(): Promise<AdminEntry[]> {
  const snapshot = await getDocs(collection(db, 'admins'))
  return snapshot.docs.map((docSnap) => ({ email: docSnap.id, ...docSnap.data() } as AdminEntry))
}

/** Grants the `admin: true` custom claim to the Firebase Auth user with
 * this email. The target user must have signed in with Google at least
 * once already (Cloud Functions can only look up existing Firebase Auth
 * users, not invite new ones). */
export async function addAdmin(email: string): Promise<void> {
  const callable = httpsCallable<{ email: string }, { email: string; uid: string }>(functions, 'addAdminClaim')
  await callable({ email })
}

/** Revokes the `admin: true` custom claim from the Firebase Auth user with
 * this email. */
export async function removeAdmin(email: string): Promise<void> {
  const callable = httpsCallable<{ email: string }, { email: string }>(functions, 'removeAdminClaim')
  await callable({ email })
}
