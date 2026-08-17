import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getAuth, type Auth } from 'firebase/auth'
import { getFunctions, type Functions } from 'firebase/functions'

// Firebase config values are safe to expose client-side (they identify the
// project, not grant access — actual access control is enforced by
// Firestore/Storage Security Rules and Firebase Auth).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True once real Firebase project credentials are provided via env vars.
 * Until then, the app degrades gracefully instead of crashing: the viewer
 * falls back to the bundled local PDF, and the admin page shows a setup
 * notice instead of attempting to authenticate against a nonexistent
 * project. */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let firebaseApp: FirebaseApp | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null
let authInstance: Auth | null = null
let functionsInstance: Functions | null = null

if (isFirebaseConfigured) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
  dbInstance = getFirestore(firebaseApp)
  storageInstance = getStorage(firebaseApp)
  authInstance = getAuth(firebaseApp)
  functionsInstance = getFunctions(firebaseApp)
}

export { firebaseApp }

/** Throws a clear error if code accidentally uses Firestore/Storage/Auth
 * before a real project is configured, instead of failing with a cryptic
 * "invalid-api-key" deep inside the SDK. */
function requireConfigured<T>(instance: T | null, label: string): T {
  if (!instance) {
    throw new Error(`Firebase ${label} is not configured — set VITE_FIREBASE_* env vars first.`)
  }
  return instance
}

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    return (requireConfigured(dbInstance, 'Firestore') as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const storage = new Proxy({} as FirebaseStorage, {
  get(_target, prop) {
    return (requireConfigured(storageInstance, 'Storage') as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (requireConfigured(authInstance, 'Auth') as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const functions = new Proxy({} as Functions, {
  get(_target, prop) {
    return (requireConfigured(functionsInstance, 'Functions') as unknown as Record<string | symbol, unknown>)[prop]
  },
})
