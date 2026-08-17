import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore'
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import { FirebaseError } from 'firebase/app'
import { db, storage } from './firebase'

const BOOKLETS_COLLECTION = 'booklets'

export interface Booklet {
  id: string
  slug: string
  name: string
  pdfPath: string
  pdfUrl: string
  fileSize: number
  pageCount: number | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface BookletInput {
  slug: string
  name: string
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export { slugify }

export async function listBooklets(): Promise<Booklet[]> {
  const snapshot = await getDocs(query(collection(db, BOOKLETS_COLLECTION), orderBy('createdAt', 'desc')))
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Booklet))
}

export async function getBookletBySlug(slug: string): Promise<Booklet | null> {
  const docRef = doc(db, BOOKLETS_COLLECTION, slug)
  const docSnap = await getDoc(docRef)
  if (!docSnap.exists()) return null
  return { id: docSnap.id, ...docSnap.data() } as Booklet
}

export async function slugExists(slug: string): Promise<boolean> {
  const docSnap = await getDoc(doc(db, BOOKLETS_COLLECTION, slug))
  return docSnap.exists()
}

export function uploadBookletPdf(
  slug: string,
  file: File,
  onProgress?: (percent: number) => void,
): { promise: Promise<{ pdfPath: string; pdfUrl: string }>; cancel: () => void } {
  const pdfPath = `booklets/${slug}/${Date.now()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu, '')}`
  const storageRef = ref(storage, pdfPath)
  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf' })

  const promise = new Promise<{ pdfPath: string; pdfUrl: string }>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (error) => reject(error),
      () => {
        void getDownloadURL(uploadTask.snapshot.ref).then((pdfUrl) => resolve({ pdfPath, pdfUrl }))
      },
    )
  })

  return { promise, cancel: () => uploadTask.cancel() }
}

export async function createBooklet(
  input: BookletInput,
  pdfPath: string,
  pdfUrl: string,
  fileSize: number,
  pageCount: number | null,
): Promise<void> {
  const docRef = doc(db, BOOKLETS_COLLECTION, input.slug)
  await setDoc(docRef, {
    slug: input.slug,
    name: input.name,
    pdfPath,
    pdfUrl,
    fileSize,
    pageCount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function renameBooklet(slug: string, name: string): Promise<void> {
  await updateDoc(doc(db, BOOKLETS_COLLECTION, slug), { name, updatedAt: serverTimestamp() })
}

export async function deleteBookletPdf(pdfPath: string): Promise<void> {
  try {
    await deleteObject(ref(storage, pdfPath))
  } catch (error) {
    if (!(error instanceof FirebaseError) || error.code !== 'storage/object-not-found') {
      throw error
    }
  }
}

export async function deleteBooklet(booklet: Booklet): Promise<void> {
  // Remove the public object before its metadata. If object deletion fails,
  // keep the record so an operator can retry without losing the object path.
  await deleteBookletPdf(booklet.pdfPath)
  await deleteDoc(doc(db, BOOKLETS_COLLECTION, booklet.id))
}
