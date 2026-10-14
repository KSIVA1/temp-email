import { measurementDay,validateRecord,previousDay } from './seo-rankings.mjs';
export function buildDashboard(config,snapshots,now,verify) {
  const today=measurementDay(now,config.measurementTimeZone),issues=[],savedDays=snapshots.map(s=>s.day).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today).sort();
  const first=savedDays[0]??today,calendar=[];for(let d=first;d<=today;d=new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10))calendar.push(d);
  const targets=config.targets.map(target=>({...target,history:calendar.map(day=>{
    const days=snapshots.filter(s=>s.day===day);if(!days.length)return {day,status:day<target.selectedOn?'untracked':'missing',rank:null};
    if(days.length!==1){issues.push(day+': duplicate daily snapshots');return {day,status:'invalid',rank:null};}
    const s=days[0],records=s.observations.filter(r=>r.query===target.query);
    if(!records.length)return {day,status:day<target.selectedOn?'untracked':'missing',rank:null};
    const r=records[0],base={day,observedAt:r.observedAt,originalFingerprint:s.targetFingerprint,evidence:r.evidence?.path??null,searchUrl:r.searchUrl??null,checkedThroughPage:r.checkedThroughPage,checkedThroughRank:r.checkedThroughRank??null,resultPage:r.resultPage??null,rankWithinPage:r.rankWithinPage??null,reason:r.reason??null};
    const errors=s.legacy?(r.status==='absent_first_page'&&r.path===target.path&&verify(r,s)?[]:['Invalid legacy first-page evidence']):validateRecord(config,s,r,now,verify);
    if(records.length!==1||errors.length){issues.push(`${day}: ${target.query}: ${errors.join('; ')}`);return {...base,evidence:null,searchUrl:null,status:'invalid',rank:null};}
    return {...base,status:r.status,rank:r.status==='observed'?r.exactOrganicRank:null,rankedUrl:r.rankedUrl??null};
  })}));
  return {generatedAt:new Date(now).toISOString(),today,latestDay:savedDays.at(-1)??today,site:config.site,country:config.country,language:config.language,device:config.primaryDevice,timeZone:config.measurementTimeZone,calendar,targets,issues:[...new Set(issues)],note:'Actual pages and within-page ranks are never inferred from overall organic counts. Original scope is retained; new queries have no fabricated backfill.'};
}
export function movement(a,b) {
  if(a.rank!=null&&b.rank!=null)return a.rank-b.rank;
  return null;
}
