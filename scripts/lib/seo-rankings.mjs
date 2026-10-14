import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
export const hash = data => createHash('sha256').update(data).digest('hex');
export const measurementDay = (value, zone) => new Intl.DateTimeFormat('en-CA', { timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(value));
export const previousDay = day => new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
export function targetFingerprint(c) {
  return hash(JSON.stringify({site:c.site,engine:c.engine,country:c.country,language:c.language,device:c.primaryDevice,zone:c.measurementTimeZone,days:c.confirmationDays,threshold:c.maxOrganicRank,targets:c.targets.filter(t=>t.priority).map(t=>({query:t.query,path:t.path})).sort((a,b)=>a.query.localeCompare(b.query))}));
}
export function searchUrlValid(value, query) {
  try { const u=new URL(value);return u.protocol==='https:'&&u.hostname==='www.google.com'&&u.pathname==='/search'&&u.searchParams.get('q')===query&&u.searchParams.get('gl')==='us'&&u.searchParams.get('hl')==='en'&&u.searchParams.get('pws')==='0'; } catch {return false;}
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// DOM snapshots escape apostrophes in quoted labels and may fold whitespace.
const renderedText = value => value.replace(/''/g, "'").replace(/\s+/g, ' ');
export function evidenceVerifier(root) {
  const cache=realpathSync(resolve(root,'.seo-cache/daily'));
  const read=artifact=>{
    if(!artifact?.path||!/^[a-f0-9]{64}$/.test(artifact.sha256??''))throw Error('Missing artifact reference');
    const p=realpathSync(resolve(root,artifact.path)),local=relative(cache,p);
    if(!local||local.startsWith('..')||isAbsolute(local))throw Error('Evidence escapes daily cache');
    const raw=readFileSync(p);if(hash(raw)!==artifact.sha256)throw Error('Changed artifact');return raw;
  };
  return (record,snapshot)=>{
    try {
      if(record.status==='unknown'&&!record.evidence)return record.checkedThroughPage===0&&Boolean(record.reason);
      if(snapshot.legacy) {
        const legacy=JSON.parse(read(record.evidence));const o=legacy.results?.find(o=>o.query===record.query&&o.observedAt===record.observedAt);
        if(!o||legacy.date!==snapshot.day||legacy.country!=='usa'||legacy.language!=='en'||legacy.device!=='desktop'||o.status!=='not_found_on_first_page'||o.rank!==null||!searchUrlValid(o.searchUrl,o.query))return false;
        const at=Date.parse(o.observedAt);if(!Number.isFinite(at)||measurementDay(at,'America/Chicago')!==snapshot.day||at>Date.now())return false;
        const dom=read(record.domEvidence).toString();return dom.includes(o.query)&&dom.includes(o.locationEvidence)&&/, [A-Z]{2} - From your IP address/.test(o.locationEvidence);
      }
      const source=JSON.parse(read(record.evidence));if(source.country!==snapshot.country||source.language!==snapshot.language||source.device!==snapshot.device||source.engine!==snapshot.engine)return false;
      const originals=source.observations?.filter(o=>o.query===record.query&&o.observedAt===record.observedAt)??[];if(originals.length!==1)return false;const o=originals[0];
      for(const k of ['status','searchUrl','exactOrganicRank','rankedUrl','checkedThroughPage','checkedThroughRank','resultPage','rankWithinPage'])if(!same(o[k]??null,record[k]??null))return false;
      if(!Array.isArray(o.pages)||o.pages.length!==record.checkedThroughPage)return false;
      let total=0;
      for(const [i,p] of o.pages.entries()) {
        if(p.page!==i+1||!searchUrlValid(p.searchUrl,record.query)||p.organicWebResultsVerified!==true||!p.organicEvidence||!Array.isArray(p.results)||!p.results.length)return false;
        const at=Date.parse(p.observedAt);if(!Number.isFinite(at)||measurementDay(at,'America/Chicago')!==snapshot.day||at>Date.now())return false;
        if(!/, [A-Z]{2} - From your IP address/.test(p.locationEvidence??''))return false;
        const dom=read({path:p.domEvidence,sha256:p.domSha256}).toString();read({path:p.screenshot,sha256:p.screenshotSha256});
        if(!dom.includes(p.locationEvidence)||!dom.includes(record.query)||!dom.includes('Sign in'))return false;
        if(i===0&&Number(new URL(p.searchUrl).searchParams.get('start')??0)!==0)return false;
        if(i>0) {const prior=o.pages[i-1];if(!prior.nextSearchUrl||!dom.includes('Previous')||new URL(prior.nextSearchUrl).searchParams.get('start')!==new URL(p.searchUrl).searchParams.get('start'))return false;}
        if(p.results.some(r=>typeof r.title!=='string'||!r.title||!/^https:\/\//.test(r.url)||!renderedText(dom).includes(renderedText(r.title))))return false;
        total+=p.results.length;
      }
      if(total!==record.checkedThroughRank||!same(o.results,o.pages.flatMap(p=>p.results)))return false;
      if(record.status==='observed') {
        const p=o.pages.find(p=>p.page===record.resultPage);if(!p||p.results[record.rankWithinPage-1]?.url!==record.rankedUrl)return false;
        if(o.pages.filter(p=>p.page<record.resultPage).reduce((n,p)=>n+p.results.length,0)+record.rankWithinPage!==record.exactOrganicRank)return false;
      } else if(o.results.some(r=>r.url===snapshot.site+record.path))return false;
      return true;
    }catch{return false;}
  };
}
export function validateRecord(c,s,r,now,verify) {
  const errors=[],fail=m=>errors.push(`${r.query}: ${m}`),target=c.targets.find(t=>t.query===r.query);
  if(!target||r.path!==target.path)fail('unknown query or changed intended page');
  const at=Date.parse(r.observedAt);if(!Number.isFinite(at)||at>+new Date(now)||measurementDay(at,c.measurementTimeZone)!==s.day)fail('invalid timestamp');
  if(!['observed','absent_first_page','unknown'].includes(r.status))fail('invalid status');
  if(!Number.isInteger(r.checkedThroughPage)||r.checkedThroughPage<0||r.checkedThroughPage>4)fail('invalid checked depth');
  if(r.status==='observed') {
    if(!Number.isInteger(r.exactOrganicRank)||r.exactOrganicRank<1||r.rankedUrl!==c.site+target?.path||!Number.isInteger(r.resultPage)||r.resultPage<1||r.resultPage>4||!Number.isInteger(r.rankWithinPage)||r.rankWithinPage<1||r.resultPage!==r.checkedThroughPage||r.organicWebResultsVerified!==true)fail('invalid exact placement');
  } else if(r.exactOrganicRank!==null||r.rankedUrl!==null||r.resultPage!=null||r.rankWithinPage!=null)fail('absence/unknown must have null placement');
  if(r.status==='absent_first_page'&&r.checkedThroughPage<1)fail('absence requires inspected pages');
  if(r.status==='unknown'&&!r.reason)fail('unknown needs a reason');
  if(r.checkedThroughPage>0&&!s.legacy&&r.source!=='google_us_serp')fail('unsupported ranking source');
  if(r.checkedThroughPage>0&&(!searchUrlValid(r.searchUrl,r.query)||!Number.isInteger(r.checkedThroughRank)||r.checkedThroughRank<1))fail('invalid search URL or organic count');
  if(s.country!==c.country||s.language!==c.language||s.device!==c.primaryDevice||s.engine!==c.engine)fail('wrong locale, device or engine');
  if(!verify(r,s))fail('missing, changed or incompatible original evidence');
  return errors;
}
export function validateRankingSnapshot(c,s,now,verify) {
  const errors=[];if(s.version!==1||s.targetFingerprint!==targetFingerprint(c))errors.push('Incompatible target fingerprint or version');
  if(!Number.isInteger(c.confirmationDays)||c.confirmationDays<1||!Number.isInteger(c.maxOrganicRank)||c.maxOrganicRank<1||c.maxOrganicRank>10)errors.push('Invalid milestone configuration');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.day??'')||!Number.isFinite(Date.parse(s.day))||s.day>measurementDay(now,c.measurementTimeZone))errors.push('Invalid measurement date');
  const records=Array.isArray(s.observations)?s.observations:[],queries=records.map(r=>r.query);
  if(new Set(queries).size!==queries.length)errors.push('Duplicate query');
  for(const t of c.targets)if(!queries.includes(t.query))errors.push('Missing query: '+t.query);
  for(const r of records)errors.push(...validateRecord(c,s,r,now,verify));return errors;
}
export function rankingProgress(c,snapshots,now,verify) {
  const today=measurementDay(now,c.measurementTimeZone),issues=[],byDay=new Map();
  for(const s of snapshots.filter(s=>s.targetFingerprint===targetFingerprint(c))) {
    const errors=validateRankingSnapshot(c,s,now,verify);if(byDay.has(s.day)){byDay.set(s.day,null);errors.push('Duplicate daily snapshots');}else byDay.set(s.day,errors.length?null:s);
    if(errors.length)issues.push({day:s.day,errors});
  }
  const streaks=c.targets.filter(t=>t.priority).map(t=>{let consecutiveTargetDays=0,consecutiveFirstPlaceDays=0;
    for(let d=today,i=0;i<c.confirmationDays;i++,d=previousDay(d)){const r=byDay.get(d)?.observations.find(r=>r.query===t.query);if(r?.status!=='observed'||r.resultPage!==1||r.exactOrganicRank>c.maxOrganicRank)break;consecutiveTargetDays++;}
    for(let d=today,i=0;i<c.confirmationDays;i++,d=previousDay(d)){const r=byDay.get(d)?.observations.find(r=>r.query===t.query);if(r?.status!=='observed'||r.resultPage!==1||r.exactOrganicRank!==1)break;consecutiveFirstPlaceDays++;}
    return {query:t.query,consecutiveTargetDays,consecutiveFirstPlaceDays};});
  return {today,requiredDays:c.confirmationDays,targetFingerprint:targetFingerprint(c),readyForEvidenceReview:streaks.length>0&&streaks.every(t=>t.consecutiveTargetDays>=c.confirmationDays),goalVerified:false,explanation:'Manual review of every original qualifying day is required before completion; readiness alone does not establish achievement.',streaks,issues};
}
export function verifyEvidenceReview(c,progress,review,snapshots,now) {
  if(!progress.readyForEvidenceReview||review?.targetFingerprint!==targetFingerprint(c)||review?.organicOriginalsManuallyReviewed!==true||!['agent','human'].includes(review?.reviewerKind)||!review?.notes?.trim())return false;
  const at=Date.parse(review.reviewedAt);if(!Number.isFinite(at)||at>+new Date(now)||measurementDay(at,c.measurementTimeZone)!==progress.today)return false;
  if(!Array.isArray(review.days)||review.days.length!==c.confirmationDays)return false;
  for(let day=progress.today,i=0;i<c.confirmationDays;i++,day=previousDay(day)) {
    const saved=snapshots.filter(s=>s.day===day&&s.targetFingerprint===targetFingerprint(c)),checked=review.days.filter(d=>d.day===day);
    if(saved.length!==1||checked.length!==1||!/^[a-f0-9]{64}$/.test(saved[0].fileSha256??'')||checked[0].snapshotSha256!==saved[0].fileSha256)return false;
  }
  return true;
}
export function loadSnapshots(root,c) {
  const cache=resolve(root,'.seo-cache/daily'),snapshots=[],issues=[];
  for(const day of (existsSync(cache)?readdirSync(cache):[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
    const file=resolve(cache,day,'rankings.json');if(!existsSync(file))continue;
    try {const raw=readFileSync(file),s=JSON.parse(raw);if(s.day){if(s.day!==day)throw Error('Directory/date mismatch');snapshots.push({...s,fileSha256:hash(raw)});continue;}
      // Explicit read-only bridge for original first-page-only history. Never a completion candidate.
      if(s.date!==day||!Array.isArray(s.results))throw Error('Unsupported historical snapshot');
      snapshots.push({version:0,legacy:true,day,engine:'Google',country:'US',language:s.language,device:s.device,targetFingerprint:'legacy-first-page-only',observations:s.results.map(r=>({query:r.query,path:'/',observedAt:r.observedAt,searchUrl:r.searchUrl,status:r.status==='not_found_on_first_page'?'absent_first_page':'unknown',exactOrganicRank:null,rankedUrl:null,checkedThroughPage:r.status==='not_found_on_first_page'?1:0,checkedThroughRank:null,reason:'Historical first-page-only check; deeper pages were not measured.',evidence:{path:relative(root,file),sha256:hash(raw)},domEvidence:{path:relative(root,resolve(cache,day,r.evidence)),sha256:hash(readFileSync(resolve(cache,day,r.evidence)))}}))});
    }catch(e){issues.push(`${day}: ${e.message}`);}
  }
  return {snapshots,issues};
}
