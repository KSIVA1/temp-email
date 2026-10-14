import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadSnapshots,rankingProgress,evidenceVerifier,verifyEvidenceReview } from './lib/seo-rankings.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),config=JSON.parse(readFileSync(resolve(root,'docs/seo-targets.json'),'utf8'));
const {snapshots,issues}=loadSnapshots(root,config),progress=rankingProgress(config,snapshots,new Date(),evidenceVerifier(root));
const reviewPath=resolve(root,'.seo-cache/daily/evidence-review.json');
if(existsSync(reviewPath))try {progress.goalVerified=verifyEvidenceReview(config,progress,JSON.parse(readFileSync(reviewPath,'utf8')),snapshots,new Date());}catch(e){issues.push('Evidence review: '+e.message);}
progress.readErrors=issues;progress.historicalSnapshotsIgnored=snapshots.filter(s=>s.targetFingerprint!==progress.targetFingerprint).length;
writeFileSync(resolve(root,'.seo-cache/daily/ranking-status.json'),JSON.stringify(progress,null,2)+'\n');console.log(JSON.stringify(progress,null,2));process.exitCode=issues.length||progress.issues.length?1:0;
