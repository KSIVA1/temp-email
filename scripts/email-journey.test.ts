import {describe,it,expect} from 'vitest';
import {startEmailJourneyApp} from './examples/email-journey-app.mjs';
import {handleEmail} from '../workers/inboxfornow-api/src/email';
import {handleHttp} from '../workers/inboxfornow-api/src/api';
import {createTestEnv,incomingEmail} from '../workers/inboxfornow-api/test/helpers';

async function fixture() {
 const env=createTestEnv();let clock=Date.now();
 await env.DB.exec("INSERT INTO domains (name, status, added_at, last_inbound_at) VALUES ('example.com', 'active', 1000, null)");
 for(const label of ['one','two'])await env.DB.prepare('INSERT INTO inboxes (id, local_part, domain, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind('inb_'+label,'qa-'+label,'example.com',clock,clock+600000).run();
 const app=await startEmailJourneyApp({now:()=>clock,deliver:async ({to,from,raw})=>{const mail=incomingEmail({to,from,raw});await handleEmail(mail,env);if(mail.rejection)throw Error('Synthetic delivery rejected');}});
 const post=async(path:string,body:unknown)=>{const r=await fetch(app.origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});return {status:r.status,data:await r.json() as {requestId?:string;accountId?:string}};};
 const tokenFor=async(label:string,requestId:string,kind:string)=>{
   // Bounded retrieval of exactly this request; never fall back to older mail.
   for(let attempt=0;attempt<3;attempt++) {
     const r=await handleHttp(new Request('https://api.inboxfornow.com/api/inbox/inb_'+label+'/messages',{headers:{Origin:'https://inboxfornow.com'}}),env);
     expect(r.status).toBe(200);
     const body=await r.json() as {messages:{subject:string;bodyHtml:string;otp?:string|null}[]};
     const message=body.messages.find(m=>m.subject===kind+' '+requestId);
     if(message){
       expect(message.otp ?? null).toBeNull();
       const routed=message.bodyHtml.match(/href="([^"]+)"/)?.[1];expect(routed,'Expected one processed action link').toBeTruthy();
       const destination=new URL(new URL(routed!,'https://inboxfornow.com').searchParams.get('u')!);
       expect(destination.origin).toBe(app.origin);expect(destination.pathname).toBe('/'+kind);
       return destination.searchParams.get('token')!;
     }
     await new Promise(resolve=>setTimeout(resolve,10));
   }
   throw Error('Current request message was not retrieved');
 };
 return {app,post,tokenFor,advance:()=>{clock+=300001;}};
}
const password='synthetic-original-password',nextPassword='synthetic-replacement-password';
describe('Original local email-dependent account journey',()=>{
 it('verifies signup, rejects stale/replayed reset links and proves the new password signs in',async()=>{
   const f=await fixture();try{
     const email='qa-one@example.com',signup=await f.post('/signup',{email,password});expect(signup.status).toBe(202);
     expect((await f.post('/login',{email,password})).status).toBe(401);
     const verify=await f.tokenFor('one',signup.data.requestId!,'verify');
     expect((await f.post('/verify',{token:verify})).data.accountId).toBe(signup.data.accountId);
     expect((await f.post('/verify',{token:verify})).status).toBe(400);
     const old=await f.post('/request-reset',{email}),fresh=await f.post('/request-reset',{email});
     const stale=await f.tokenFor('one',old.data.requestId!,'reset'),current=await f.tokenFor('one',fresh.data.requestId!,'reset');
     expect((await f.post('/reset',{token:stale,password:nextPassword})).status).toBe(400);
     expect((await f.post('/reset',{token:current,password:nextPassword})).status).toBe(200);
     expect((await f.post('/reset',{token:current,password:'synthetic-replay-password'})).status).toBe(400);
     expect((await f.post('/login',{email,password})).status).toBe(401);
     const login=await f.post('/login',{email,password:nextPassword});expect(login.status).toBe(200);expect(login.data.accountId).toBe(signup.data.accountId);
   }finally{await f.app.close();}
 });
 it('expires the application token independently of the receiving inbox lifetime',async()=>{
   const f=await fixture();try{const s=await f.post('/signup',{email:'qa-one@example.com',password}),token=await f.tokenFor('one',s.data.requestId!,'verify');f.advance();expect((await f.post('/verify',{token})).status).toBe(400);expect(await f.tokenFor('one',s.data.requestId!,'verify')).toBe(token);}finally{await f.app.close();}
 });
 it('isolates concurrent accounts and fails a wait for a request that never arrived',async()=>{
   const f=await fixture();try{
     const users=await Promise.all(['one','two'].map(async label=>{const s=await f.post('/signup',{email:'qa-'+label+'@example.com',password}),token=await f.tokenFor(label,s.data.requestId!,'verify');const v=await f.post('/verify',{token});expect(v.status).toBe(200);expect(v.data.accountId).toBe(s.data.accountId);return s.data.accountId;}));expect(users[0]).not.toBe(users[1]);
     await expect(f.tokenFor('two','request-not-sent','verify')).rejects.toThrow('Current request message was not retrieved');
   }finally{await f.app.close();}
 });
});
