import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../src/record.mjs';
const record = {lot:'DEMO-001',date:'2026-10-30',process:'仕込み',quantity:'12.5'};
test('valid manufacturing record',()=>assert.equal(validateRecord(record),''));
test('reject empty lot',()=>assert.notEqual(validateRecord({...record,lot:'  '}),''));
test('reject negative or invalid quantity',()=>{for(const quantity of ['-1','NaN','Infinity']) assert.notEqual(validateRecord({...record,quantity}), '');});
test('reject impossible date',()=>assert.notEqual(validateRecord({...record,date:'2026-02-30'}),''));
test('quantity may remain unspecified until form is agreed',()=>assert.equal(validateRecord({...record,quantity:''}),''));
