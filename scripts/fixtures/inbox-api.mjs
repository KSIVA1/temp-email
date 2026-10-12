// Local synthetic API for browser regression checks. Never deploy this fixture.
// Build with PUBLIC_API_BASE=http://127.0.0.1:4399 and run Astro preview.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const inboxes = new Map();
const counts = { creates:0, reads:0, messages:0 };
const controls = { createStatus:201, readStatus:200, delayMs:0, messageDelayMs:0 };
function reply(res, code, data) {
  res.writeHead(code, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
  res.end(JSON.stringify(data));
}
async function body(req) { let value=''; for await (const chunk of req) value+=chunk; return JSON.parse(value || '{}'); }
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://127.0.0.1:4399');
    if(req.method==='OPTIONS') return reply(res,204,{});
    if(url.pathname==='/__test/control' && req.method==='POST') {
      const next=await body(req);
      Object.assign(controls,next);
      if(next.expireAll) for(const inbox of inboxes.values()) inbox.expiresAt=Date.now()-1;
      return reply(res,200,{controls,counts});
    }
    if(url.pathname==='/__test/status') return reply(res,200,{controls,counts,inboxes:inboxes.size});
    if(url.pathname==='/api/inbox' && req.method==='POST') {
      counts.creates++;
      const status=controls.createStatus;
      await delay(controls.delayMs);
      if(status!==201) return reply(res,status,{error:'Synthetic creation failure'});
      const inbox={id:`inb_${randomUUID()}`,address:`fixture${counts.creates}@example.test`,expiresAt:Date.now()+600000,receivedAt:Date.now()};
      inboxes.set(inbox.id,inbox);
      return reply(res,201,inbox);
    }
    const match=url.pathname.match(/^\/api\/inbox\/([^/]+)(?:\/(messages|extend)(?:\/([^/]+))?)?$/);
    if(!match) return reply(res,404,{error:'Fixture route not found'});
    const [,id,resource,messageId]=match;
    const inbox=inboxes.get(id);
    if(!inbox || inbox.expiresAt<=Date.now()) return reply(res,404,{error:'Expired fixture'});
    if(req.method==='DELETE' && resource==='messages' && messageId===`msg_${id}`) {
      inbox.messageDeleted=true;
      return reply(res,200,{ok:true});
    }
    if(req.method==='DELETE' && !resource) {inboxes.delete(id);return reply(res,200,{ok:true});}
    if(resource==='extend') {
      const data=await body(req);
      inbox.expiresAt=Math.min(inbox.expiresAt+data.seconds*1000,Date.now()+86400000);
      return reply(res,200,{expiresAt:inbox.expiresAt});
    }
    if(resource==='messages') {
      counts.messages++;
      const sentAt=inbox.receivedAt;
      const messages=inbox.messageDeleted || Number(url.searchParams.get('since'))>=sentAt?[]:[{id:`msg_${id}`,fromName:'Synthetic QA',fromEmail:'qa@example.test',subject:`Fixture for ${inbox.address}`,preview:'Local browser regression fixture.',bodyHtml:'<p>Verification code: 418229</p><p><a href="https://example.test/verify">Synthetic verification link</a></p>',receivedAt:sentAt,otp:'418229'}];
      await delay(controls.messageDelayMs);
      return reply(res,200,{messages});
    }
    counts.reads++;
    await delay(controls.delayMs);
    return controls.readStatus===200 ? reply(res,200,inbox) : reply(res,controls.readStatus,{error:'Synthetic reconnection failure'});
  } catch { reply(res,500,{error:'Invalid fixture request'}); }
}).listen(4399,'127.0.0.1',()=>console.log('Synthetic inbox API listening on 127.0.0.1:4399'));
