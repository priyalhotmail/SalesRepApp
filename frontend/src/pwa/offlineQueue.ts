export type OfflineQueueOperation =
  | "CREATE_ORDER"
  | "UPDATE_DELIVERY"
  | "CAPTURE_PAYMENT"
  | "CREATE_RETURN"
  | "COMPLETE_VISIT"
  | "CREATE_ATTACHMENT";

export type OfflineQueueItem = {
  id: string;
  createdAt: string;
  endpoint: string;
  error?: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  operation: OfflineQueueOperation;
  payload: unknown;
  retryCount: number;
  status: "PENDING" | "SYNCING" | "FAILED" | "SYNCED";
};

const databaseName = "sales-system-offline";
const databaseVersion = 1;
const queueStoreName = "syncQueue";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(queueStoreName)) {
        const store = database.createObjectStore(queueStoreName, {
          keyPath: "id"
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withQueueStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const database = await openDatabase();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(queueStoreName, mode);
    const store = transaction.objectStore(queueStoreName);
    const request = callback(store);

    transaction.oncomplete = () =>
      resolve(request ? (request.result as T) : undefined);
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => database.close());
}

export async function enqueueOfflineRequest(
  item: Omit<OfflineQueueItem, "createdAt" | "id" | "retryCount" | "status">
) {
  const queueItem: OfflineQueueItem = {
    ...item,
    createdAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    retryCount: 0,
    status: "PENDING"
  };

  await withQueueStore("readwrite", (store) => store.add(queueItem));
  return queueItem;
}

export async function listQueuedRequests() {
  const result = await withQueueStore<OfflineQueueItem[]>("readonly", (store) =>
    store.getAll()
  );
  return result ?? [];
}

export async function updateQueuedRequest(item: OfflineQueueItem) {
  await withQueueStore("readwrite", (store) => store.put(item));
}

export async function removeQueuedRequest(id: string) {
  await withQueueStore("readwrite", (store) => store.delete(id));
}

export async function syncQueuedRequests(authToken?: string) {
  if (!navigator.onLine) {
    return { failed: 0, synced: 0 };
  }

  const items = (await listQueuedRequests()).filter(
    (item) => item.status === "PENDING" || item.status === "FAILED"
  );
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    await updateQueuedRequest({ ...item, status: "SYNCING" });

    try {
      const response = await fetch(item.endpoint, {
        body: JSON.stringify(item.payload),
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        method: item.method
      });

      if (!response.ok) {
        throw new Error(`Sync failed with HTTP ${response.status}`);
      }

      await removeQueuedRequest(item.id);
      synced += 1;
    } catch (error) {
      await updateQueuedRequest({
        ...item,
        error: error instanceof Error ? error.message : "Sync failed",
        retryCount: item.retryCount + 1,
        status: "FAILED"
      });
      failed += 1;
    }
  }

  return { failed, synced };
}
