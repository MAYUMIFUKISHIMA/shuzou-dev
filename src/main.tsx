import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { validateRecord } from './record.mjs';
import { transact, enqueue, switchOwner, type Snapshot } from './local-store';
const today = () => new Date().toLocaleDateString('sv-SE');
const blank = () => ({ lot: '', process: '仕込み', date: today(), quantity: '', note: '' });
function App() {
 const [tab, setTab] = useState('入力');
 const [form, setForm] = useState(blank);
 const [snapshot, setSnapshot] = useState<Snapshot>({owner:'', entries:[]});
 const [ready, setReady] = useState(false);
 const [busy, setBusy] = useState(false);
 const lock = useRef(false);
 const [online, setOnline] = useState(navigator.onLine);
 const entries = snapshot.entries;
 useEffect(() => { setForm(blank()); }, [snapshot.owner]);
 useEffect(() => {
  const refresh = () => { setOnline(navigator.onLine); transact().then(s => {setSnapshot(s); setReady(true);}).catch(() => {setReady(false); setMessage('端末保存を利用できません。ブラウザの設定を確認してください。');}); };
  refresh(); window.addEventListener('online', refresh); window.addEventListener('offline', refresh); window.addEventListener('focus', refresh);
  return () => {window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); window.removeEventListener('focus', refresh);};
 }, []);
 async function save() {
  if(lock.current || !ready) return;
  const error = validateRecord(form); if(error) {setMessage(error); return;}
  lock.current = true; setBusy(true);
  try {setSnapshot(await enqueue({...form, owner:snapshot.owner, id:crypto.randomUUID()})); setForm(blank()); setMessage('端末に保存しました。クラウドには未送信です。');}
  catch(error) {setMessage(error instanceof Error ? error.message : '保存できませんでした。入力内容はそのままです。');}
  finally {lock.current = false; setBusy(false);}
 }
 async function changeUser() {
  if(lock.current || !ready) return;
  if(!confirm(`未送信の記録が${entries.length}件あります。入力途中の内容も破棄して交代しますか？`)) return;
  lock.current = true; setBusy(true);
  try {setSnapshot(await switchOwner(snapshot)); setForm(blank()); setMessage('端末の記録を破棄し、デモ利用者を切り替えました。');}
  catch(error) {setMessage(error instanceof Error ? error.message : '破棄に失敗しました。交代は完了していません。');}
  finally {lock.current = false; setBusy(false);}
 }
 const [message, setMessage] = useState('');
 return <><header><span className="brand">蔵の記録</span><span>製造部門 · 試作版</span></header><main>
 <div className="notice">仮データの画面確認用です。端末への一時保存を試せます。ログイン・クラウド送信は未接続です。実際の業務データは入力しないでください。</div>
 <section aria-label="端末の状態"><strong>{snapshot.owner || '読み込み中'} · {online ? 'ネットワーク接続あり' : 'オフライン'}</strong><p>未送信：{entries.length}件</p><p className="muted">接続表示はクラウドへの到達を保証しません。送信機能は準備中です。</p><button disabled={!ready || busy} onClick={changeUser}>破棄してデモ利用者を交代</button></section>
 <nav aria-label="メイン"><button aria-current={tab === '入力' ? 'page' : undefined} onClick={() => setTab('入力')}>記録する</button><button aria-current={tab === '一覧' ? 'page' : undefined} onClick={() => setTab('一覧')}>記録を見る ({entries.length})</button></nav>
 {tab === '入力' ? <><p className="eyebrow">仕込みから蒸留まで</p><h1>今日の作業を記録</h1><p className="muted">帳票を確認するための仮フォームです。項目は後から調整します。</p>
 <form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={!ready || busy}>
 <label>作業日<input required type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})}/></label>
 <label>仕込み番号<input required maxLength={80} placeholder="例：DEMO-001" value={form.lot} onChange={e => setForm({...form,lot:e.target.value})}/></label>
 <label>工程<select value={form.process} onChange={e => setForm({...form,process:e.target.value})}>{['仕込み','発酵管理','蒸留'].map(p => <option key={p}>{p}</option>)}</select></label>
 <label>数量（単位・定義は帳票確認後に確定）<input type="number" min="0" step="any" value={form.quantity} onChange={e => setForm({...form,quantity:e.target.value})}/></label>
 <label>作業メモ<textarea maxLength={2000} rows={4} value={form.note} onChange={e => setForm({...form,note:e.target.value})}/></label>
 <button className="primary" type="submit">端末に一時保存</button><p className="muted">保存した記録は再読み込み後も残ります。保存前の入力は残りません。ブラウザのデータ消去で失われるため実データは入力しないでください。</p></fieldset>
 </form></> : <><p className="eyebrow">試作データ</p><h1>作業記録</h1>{entries.length === 0 ? <section>記録はまだありません。「記録する」から仮の記録を追加できます。</section> : entries.map(e => <section key={e.id}><span className="badge">{e.process} · 未送信</span><h2>{e.lot}</h2><p>{e.date} · 数量：{e.quantity || '未入力'}</p><p className="note">{e.note}</p></section>)}</>}
 <p role="status">{message}</p><footer>開発中 · 本番運用前に認証・権限・同期・バックアップを検証します</footer></main></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
