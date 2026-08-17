const DATABASE_NAME = 'riffai-booklet-library'
const STORE_NAME = 'books'
const DATABASE_VERSION = 1

export interface StoredBook {
  id: string
  name: string
  blob: Blob
  createdAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('เปิดคลังเอกสารไม่สำเร็จ'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('จัดการคลังเอกสารไม่สำเร็จ'))
  })
}

export async function listStoredBooks(): Promise<StoredBook[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const books = await requestToPromise(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<StoredBook[]>)
    return books.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    database.close()
  }
}

export async function saveStoredBook(book: StoredBook): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(STORE_NAME).put(book))
  } finally {
    database.close()
  }
}

export async function deleteStoredBook(id: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(id))
  } finally {
    database.close()
  }
}
