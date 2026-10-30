export type Entry = {
  id: string;
  owner: string;
  lot: string;
  process: string;
  date: string;
  quantity: string;
  note: string;
};
export type Snapshot = { owner: string; entries: Entry[] };
const initial = (): Snapshot => ({ owner: "デモ作業員A", entries: [] });
let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("shuzou-demo-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
// The read and mutation share one transaction, including across browser tabs.
export async function transact(
  change?: (state: Snapshot) => Snapshot,
): Promise<Snapshot> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", change ? "readwrite" : "readonly");
    const store = tx.objectStore("state");
    const request = store.get("current");
    let result: Snapshot;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        result = request.result ?? initial();
        if (change) {
          result = change(result);
          store.put(result, "current");
        }
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(failure ?? tx.error ?? new Error("端末保存に失敗しました"));
  });
}
export function enqueue(entry: Entry) {
  return transact((state) => {
    if (state.owner !== entry.owner)
      throw new Error(
        "別の画面で利用者が切り替わりました。再読み込みしてください。",
      );
    if (state.entries.some((e) => e.id === entry.id)) return state;
    return { ...state, entries: [...state.entries, entry] };
  });
}
export function switchOwner(expected: Snapshot) {
  return transact((state) => {
    if (JSON.stringify(state) !== JSON.stringify(expected))
      throw new Error(
        "別の画面で記録が変わりました。一覧を再読み込みして確認してください。",
      );
    return {
      owner: state.owner === "デモ作業員A" ? "デモ作業員B" : "デモ作業員A",
      entries: [],
    };
  });
}
