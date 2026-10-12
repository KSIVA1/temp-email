import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInboxSession } from '../src/lib/inbox-session.ts';

const first = {id:'inb_11111111-1111-4111-8111-111111111111',address:'test11111@example.test',expiresAt:2000};
const second = {id:'inb_22222222-2222-4222-8222-222222222222',address:'test22222@example.test',expiresAt:3000};
const failure = status => Object.assign(new Error('API failure'),{status});
function store(initial) {
  const values = new Map(initial ? [['ifn-active-inbox', initial]] : []);
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
}
function fixture(storage = store()) {
  let reads=0, creates=0;
  const options = {storage,now:()=>1000,readInbox:async()=>{reads++;return first;},createInbox:async()=>{creates++;return first;}};
  return {options,counts:()=>({reads,creates})};
}

test('reload restores the same server-validated inbox and its original deadline', async () => {
  const f = fixture();
  assert.deepEqual(await createInboxSession(f.options).connect(), first);
  assert.deepEqual(await createInboxSession(f.options).connect(), first);
  assert.deepEqual(f.counts(), {reads:1,creates:1});
});
test('server extension is authoritative even when a previous client deadline would be expired', async () => {
  const f = fixture(store(first.id));
  f.options.readInbox = async()=>({...first,expiresAt:5000});
  assert.equal((await createInboxSession(f.options).connect()).expiresAt,5000);
  assert.equal(f.counts().creates,0);
});
test('a definite expired or deleted inbox creates a fresh session', async () => {
  const f = fixture(store(first.id));
  f.options.readInbox = async()=>{throw failure(404);};
  f.options.createInbox = async()=>second;
  assert.deepEqual(await createInboxSession(f.options).connect(),second);
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),second.id);
});
for (const status of [undefined,429,500,503]) test(`${status ? 'HTTP '+status : 'Network failure'} retains the inbox for a retry without creating another`,async()=>{
  const f = fixture(store(first.id));
  f.options.readInbox = async()=>{throw failure(status);};
  const session = createInboxSession(f.options);
  await assert.rejects(session.connect());
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),first.id);
  assert.equal(f.counts().creates,0);
  f.options.readInbox = async()=>first;
  assert.deepEqual(await session.connect(),first);
});
test('a failed deliberate replacement keeps the previous inbox',async()=>{
  const f = fixture(store(first.id));
  f.options.createInbox=async()=>{throw failure(503);};
  const session=createInboxSession(f.options);
  await assert.rejects(session.connect(true));
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),first.id);
  assert.deepEqual(await session.connect(),first);
});
test('concurrent connection attempts create only one inbox',async()=>{
  const f = fixture();
  let finish;
  f.options.createInbox=()=>new Promise(resolve=>{finish=resolve;});
  const session=createInboxSession(f.options);
  const a=session.connect(), b=session.connect();
  assert.equal(a,b);
  finish(first);
  assert.deepEqual(await a,first);
});
test('malformed storage is never used as an API path',async()=>{
  const f=fixture(store('../../another-inbox'));
  assert.deepEqual(await createInboxSession(f.options).connect(),first);
  assert.equal(f.counts().reads,0);
});
test('mismatched or expired API responses cannot replace a valid session',async()=>{
  const f=fixture(store(first.id));
  const session=createInboxSession(f.options);
  f.options.readInbox=async()=>second;
  await assert.rejects(session.connect(),/Invalid/);
  f.options.readInbox=async()=>({...first,expiresAt:999});
  await assert.rejects(session.connect(),/expired/);
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),first.id);
  assert.equal(f.counts().creates,0);
});
test('explicit deletion forgets the identifier and stale expiry cannot forget a newer one',async()=>{
  const f=fixture(store(first.id));
  f.options.createInbox=async()=>second;
  const session=createInboxSession(f.options);
  await session.connect(true);
  session.forget(first.id);
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),second.id);
  session.forget(second.id);
  assert.equal(f.options.storage.getItem('ifn-active-inbox'),null);
});
test('blocked browser storage preserves an in-memory inbox',async()=>{
  const f=fixture({getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}});
  const session=createInboxSession(f.options);
  await session.connect();
  await session.connect();
  assert.equal(session.retainedInTab,false);
  assert.deepEqual(f.counts(),{creates:1,reads:1});
});
