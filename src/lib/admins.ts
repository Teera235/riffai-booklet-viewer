import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

const ADMINS_COLLECTION = 'admins'

export interface AdminEntry {
  email: string
  addedAt: Timestamp | null
  addedBy: string | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const docSnap = await getDoc(doc(db, ADMINS_COLLECTION, normalizeEmail(email)))
  return docSnap.exists()
}

export async function listAdmins(): Promise<AdminEntry[]> {
  const snapshot = await getDocs(collection(db, ADMINS_COLLECTION))
  return snapshot.docs.map((docSnap) => ({ email: docSnap.id, ...docSnap.data() } as AdminEntry))
}

export async function addAdmin(email: string, addedBy: string): Promise<void> {
  const normalized = normalizeEmail(email)
  await setDoc(doc(db, ADMINS_COLLECTION, normalized), {
    addedAt: serverTimestamp(),
    addedBy,
  })
}

export async function removeAdmin(email: string): Promise<void> {
  await deleteDoc(doc(db, ADMINS_COLLECTION, normalizeEmail(email)))
}
