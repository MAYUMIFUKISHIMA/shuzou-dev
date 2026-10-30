import type { Payload } from "./cloud";
export type Pending = { id: string; payload: Payload };
type Queue = { owner: string; records: Pending[] };
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("shuzou-cloud-queue", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("queue");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function update<T>(
  fn: (q: Queue) => { queue: Queue; result: T },
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("queue", "readwrite"),
      store = tx.objectStore("queue");
    const r = store.get("current");
    let result: T;
    let failure: unknown;
    r.onsuccess = () => {
      try {
        const next = fn(r.result ?? { owner: "", records: [] });
        result = next.result;
        store.put(next.queue, "current");
      } catch (e) {
        failure = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      database.close();
      resolve(result);
    };
    tx.onabort = () => {
      database.close();
      reject(failure ?? tx.error);
    };
  });
}
export function queueFor(owner: string) {
  return update((q) => {
    if (q.owner && q.owner !== owner)
      throw new Error(
        "前の利用者の端末データがあります。破棄して利用を開始してください。",
      );
    const queue = { ...q, owner };
    return { queue, result: queue.records };
  });
}
export function addPending(owner: string, record: Pending) {
  return update((q) => {
    if (q.owner !== owner)
      throw new Error("利用者が変わりました。再ログインしてください。");
    const records = q.records.some((r) => r.id === record.id)
      ? q.records
      : [...q.records, record];
    return { queue: { owner, records }, result: records };
  });
}
export function acknowledge(owner: string, id: string) {
  return update((q) => {
    if (q.owner !== owner) throw new Error("利用者が変わりました。");
    const records = q.records.filter((r) => r.id !== id);
    return { queue: { owner, records }, result: records };
  });
}
export function discardQueue() {
  return update(() => ({
    queue: { owner: "", records: [] },
    result: undefined,
  }));
}
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "このブラウザでは安全な同期を利用できません。最新のChromeとHTTPSを使用してください。",
    );
  return navigator.locks.request("shuzou-cloud-queue", fn);
}
