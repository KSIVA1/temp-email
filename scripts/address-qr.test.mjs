import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { createAddressQr } from '../src/lib/address-qr.ts';

for (const address of ['fox12345@veqla.com','badger99999@example.test','QA+signup123@example.test','a@b.co']) {
  test(`an independent decoder reads ${address} at the displayed size`,async()=>{
    const svg=createAddressQr(address);
    const {data,info}=await sharp(Buffer.from(svg)).resize(160,160).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height,{inversionAttempts:'dontInvert'});
    assert.equal(decoded?.data,address);
    assert.ok(!decoded.data.includes('inb_') && !decoded.data.includes('https://'));
  });
}
test('a changed inbox produces a code for the new address',async()=>{
  const first=createAddressQr('fox12345@veqla.com');
  const second=createAddressQr('otter54321@veqla.com');
  assert.notEqual(first,second);
  const {data,info}=await sharp(Buffer.from(second)).resize(160,160).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data,'otter54321@veqla.com');
});
test('URLs, session identifiers, loading text and markup cannot become an address code',()=>{
  for(const input of ['', 'Connecting…','https://example.test/?inbox=inb_secret','inb_11111111-1111-4111-8111-111111111111','mailto:a@example.test','<script>@example.test','a\nb@example.test','x'.repeat(65)+'@example.test']) {
    assert.throws(()=>createAddressQr(input),/receiving email/);
  }
});
