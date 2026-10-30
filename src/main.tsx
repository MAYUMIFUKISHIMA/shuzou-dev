import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { validateRecord } from './record.mjs';
type Entry = { id: string; lot: string; process: string; date: string; quantity: string; note: string };
const today = () => new Date().toLocaleDateString('sv-SE');
const blank = () => ({ lot: '', process: '仕込み', date: today(), quantity: '', note: '' });
function App() {
 const [tab, setTab] = useState('入力');
 const [form, setForm] = useState(blank);
 const [entries, setEntries] = useState<Entry[]>([]);
 const [message, setMessage] = useState('');
 return <><header><span className="brand">蔵の記録</span><span>製造部門 · 試作版</span></header><main>
 <div className="notice">仮データの画面確認用です。ログイン・クラウド保存・圏外保存は未接続です。実際の業務データは入力しないでください。</div>
 <nav aria-label="メイン"><button aria-current={tab === '入力' ? 'page' : undefined} onClick={() => setTab('入力')}>記録する</button><button aria-current={tab === '一覧' ? 'page' : undefined} onClick={() => setTab('一覧')}>記録を見る ({entries.length})</button></nav>
 {tab === '入力' ? <><p className="eyebrow">仕込みから蒸留まで</p><h1>今日の作業を記録</h1><p className="muted">帳票を確認するための仮フォームです。項目は後から調整します。</p>
 <form onSubmit={e => { e.preventDefault(); const error = validateRecord(form); if(error) {setMessage(error); return;} setEntries([...entries, {...form, id: crypto.randomUUID()}]); setForm(blank()); setMessage('デモ一覧に追加しました。クラウドには保存されていません。'); }}>
 <label>作業日<input required type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})}/></label>
 <label>仕込み番号<input required maxLength={80} placeholder="例：DEMO-001" value={form.lot} onChange={e => setForm({...form,lot:e.target.value})}/></label>
 <label>工程<select value={form.process} onChange={e => setForm({...form,process:e.target.value})}>{['仕込み','発酵管理','蒸留'].map(p => <option key={p}>{p}</option>)}</select></label>
 <label>数量（単位・定義は帳票確認後に確定）<input type="number" min="0" step="any" value={form.quantity} onChange={e => setForm({...form,quantity:e.target.value})}/></label>
 <label>作業メモ<textarea maxLength={2000} rows={4} value={form.note} onChange={e => setForm({...form,note:e.target.value})}/></label>
 <button className="primary" type="submit">デモ一覧に追加</button><p className="muted">この画面を再読み込みするとデモ記録は消えます。</p>
 </form></> : <><p className="eyebrow">試作データ</p><h1>作業記録</h1>{entries.length === 0 ? <section>記録はまだありません。「記録する」から仮の記録を追加できます。</section> : entries.map(e => <section key={e.id}><span className="badge">{e.process}</span><h2>{e.lot}</h2><p>{e.date} · 数量：{e.quantity || '未入力'}</p><p className="note">{e.note}</p></section>)}</>}
 <p role="status">{message}</p><footer>開発中 · 本番運用前に認証・権限・同期・バックアップを検証します</footer></main></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
