import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 const page = await context.newPage();
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'端末に一時保存'}).waitFor();
 await page.getByLabel('仕込み番号').fill('OFFLINE-001');
 await context.setOffline(true);
 await page.getByRole('button',{name:'端末に一時保存'}).click();
 await page.getByText('未送信：1件',{exact:true}).waitFor();
 await context.setOffline(false);
 await page.reload();
 await page.getByText('未送信：1件',{exact:true}).waitFor();
 await page.getByRole('button',{name:'記録を見る (1)'}).click();
 await page.getByRole('heading',{name:'OFFLINE-001'}).waitFor();
 page.once('dialog', d => d.dismiss());
 await page.getByRole('button',{name:'破棄してデモ利用者を交代'}).click();
 await page.getByText('未送信：1件',{exact:true}).waitFor();
 page.once('dialog', d => d.accept());
 await page.getByRole('button',{name:'破棄してデモ利用者を交代'}).click();
 await page.getByText('未送信：0件',{exact:true}).waitFor();
 await page.reload();
 await page.getByText(/デモ作業員B ·/).waitFor();
 await page.getByText('未送信：0件',{exact:true}).waitFor();
 // Simulate a write failure; the form must not be cleared or claim success.
 await page.evaluate(() => { IDBObjectStore.prototype.put = function(){throw new DOMException('保存容量不足','QuotaExceededError');}; });
 await page.getByLabel('仕込み番号').fill('KEEP-ON-FAILURE');
 await page.getByRole('button',{name:'端末に一時保存'}).click();
 await page.getByRole('status').filter({hasText:'保存容量不足'}).waitFor();
 assert.equal(await page.getByLabel('仕込み番号').inputValue(),'KEEP-ON-FAILURE');
 await page.reload();
 // Exercise transaction guards against stale tabs and duplicate enqueue IDs.
 const outcome = await page.evaluate(async () => {
  const {transact,enqueue,switchOwner} = await import('/src/local-store.ts');
  const before = await transact();
  const entry = {id:'stable-id',owner:before.owner,lot:'TEST',date:'2026-10-30',process:'仕込み',quantity:'1',note:''};
  await Promise.all([enqueue(entry),enqueue(entry)]);
  const after = await transact();
  let blocked = false;
  try {await switchOwner(before);} catch {blocked = true;}
  return {count:after.entries.length,blocked};
 });
 assert.deepEqual(outcome,{count:1,blocked:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
 await context.close();
 // Storage unavailable must disable submission.
 const denied = await browser.newContext();
 await denied.addInitScript(()=>{indexedDB.open = () => {throw new DOMException('Blocked','SecurityError');};});
 const blockedPage = await denied.newPage();
 await blockedPage.goto('http://127.0.0.1:5173');
 await blockedPage.getByRole('status').filter({hasText:'端末保存を利用できません'}).waitFor();
 assert.equal(await blockedPage.getByRole('button',{name:'端末に一時保存'}).isDisabled(),true);
 console.log('PASS: offline save, reload persistence, switch cancellation/cleanup, write failure, duplicate ID, stale snapshot guard, storage denied, mobile width');
} finally {await browser.close();}
