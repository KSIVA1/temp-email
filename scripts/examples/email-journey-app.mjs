// Local teaching application, not a production authentication service.
// deliver receives synthetic MIME: tests connect it to our actual email handler.
import {createServer} from 'node:http';
import {randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
export async function startEmailJourneyApp({deliver, now = Date.now}) {
  const users = new Map(), tokens = new Map();
  let origin;
  const digest = (password, salt) => scryptSync(password, salt, 32);
  const server = createServer(async (req, res) => {
    const reply = (status, data) => {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      if (req.method !== 'POST') return reply(405,{error:'Use a POST in the local test.'});
      const chunks=[];let bytes=0;
      for await (const chunk of req) {bytes+=chunk.length;if(bytes>8192)return reply(413,{error:'Fixture too large.'});chunks.push(chunk);}
      const b=JSON.parse(Buffer.concat(chunks).toString()), email=b.email;
      if (req.url==='/signup') {
        if(typeof email!=='string'||!/^qa-[a-z0-9-]+@example\.com$/.test(email)||typeof b.password!=='string'||b.password.length<12)return reply(400,{error:'Use a synthetic qa- recipient and a test password.'});
        if(users.has(email))return reply(409,{error:'Use a separate account per test.'});
        const salt=randomUUID();users.set(email,{id:randomUUID(),salt,password:digest(b.password,salt),verified:false,resetVersion:0});
      }
      if(req.url==='/signup'||req.url==='/request-reset') {
        const user=users.get(email),kind=req.url==='/signup'?'verify':'reset';
        if(!user||kind==='reset'&&!user.verified)return reply(400,{error:'No verified synthetic account.'});
        const requestId=randomUUID(),token=randomUUID();
        if(kind==='reset')user.resetVersion++;
        tokens.set(token,{email,kind,version:user.resetVersion,expires:now()+300000,used:false});
        const link=origin+'/'+kind+'?token='+token;
        const raw=['From: Local Journey <sender@example.com>','To: '+email,'Subject: '+kind+' '+requestId,'MIME-Version: 1.0','Content-Type: text/html; charset=utf-8','','<p>Request: '+requestId+'</p><p><a href="'+link+'">Complete '+kind+'</a></p>',''].join('\r\n');
        await deliver({to:email,from:'sender@example.com',raw,requestId,kind});
        return reply(202,{requestId,accountId:user.id});
      }
      if(req.url==='/verify'||req.url==='/reset') {
        const token=tokens.get(b.token),kind=req.url.slice(1),user=token&&users.get(token.email);
        if(!token||!user||token.kind!==kind||token.used||token.expires<=now()||kind==='reset'&&token.version!==user.resetVersion)return reply(400,{error:'Invalid, expired, stale or used token.'});
        if(kind==='reset'&&(typeof b.password!=='string'||b.password.length<12))return reply(400,{error:'Use a synthetic password of at least 12 characters.'});
        token.used=true;
        if(kind==='verify')user.verified=true;
        else user.password=digest(b.password,user.salt);
        return reply(200,{accountId:user.id,verified:user.verified});
      }
      if(req.url==='/login') {
        const user=users.get(email);
        if(!user?.verified||typeof b.password!=='string'||!timingSafeEqual(digest(b.password,user.salt),user.password))return reply(401,{error:'Invalid login.'});
        return reply(200,{accountId:user.id});
      }
      reply(404,{error:'Unknown demo action.'});
    }catch {reply(500,{error:'Local demo failed; check the test output.'});}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  return {origin,close:()=>new Promise((resolve,reject)=>{server.close(err=>err?reject(err):resolve());server.closeAllConnections();})};
}
