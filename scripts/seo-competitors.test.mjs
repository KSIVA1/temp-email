import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findReview, selectResearchPage, comparisonLabel} from './lib/seo-competitors.mjs';
test('display comparison never presents stale or unresolved results as current page movement',()=>{
 const r={title:'Synthetic guide',displayedDestination:'https://example.com/guide'};
 assert.equal(comparisonLabel(r,[r]),'Same displayed result');
 assert.equal(comparisonLabel({...r,displayedDestination:'https://example.com/other'},[r]),'New or changed display');
 assert.equal(comparisonLabel(r,[r],true),'Prior-date research only');
 assert.equal(comparisonLabel({...r,displayedDestination:null},[r]),'Destination unresolved');
});
test('homepage review never covers a different or unresolved deep result by domain',()=>{
 const notes=[{query:'test',domain:'example.com',status:'reviewed',url:'https://example.com/'}];
 assert.equal(findReview(notes,'test',{title:'Guide',displayedDestination:'https://example.com › guides › ...'}),null);
 assert.equal(findReview(notes,'test',{title:'Guide',displayedDestination:'https://example.com/guide'}),null);
 assert.equal(findReview(notes,'different',{title:'Home',displayedDestination:'https://example.com'}),null);
 assert.equal(findReview(notes,'test',{title:'Home',displayedDestination:'https://www.example.com/'}),notes[0]);
});
test('ambiguous display requires explicit matching research evidence and result binding',()=>{
 const r={title:'Exact guide',displayedDestination:'https://example.com › guides › ...'};
 const n={query:'test',status:'reviewed',url:'https://example.com/guides/exact',resultBinding:{...r,resolvedUrl:'https://example.com/guides/exact',evidence:'private/original.md'}};
 assert.equal(findReview([n],'test',r),n);
 assert.equal(findReview([n],'test',{...r,title:'Another guide'}),null);
 assert.equal(findReview([{...n,resultBinding:{...n.resultBinding,evidence:null}}],'test',r),null);
});
test('research fallback retains original date and skips invalid evidence without creating rankings',()=>{
 const page={page:1,organicWebResultsVerified:true,results:[{title:'Synthetic',url:'https://example.com'}]};
 const records=[{day:'2026-10-15',errors:[],source:{observations:[]}},{day:'2026-10-14',errors:['bad hash'],source:{observations:[{query:'test',pages:[page]}]}},{day:'2026-10-13',errors:[],source:{observations:[{query:'test',pages:[page]}]}}];
 const chosen=selectResearchPage(records,'test');assert.equal(chosen.day,'2026-10-13');assert.equal(chosen.page,page);assert.equal(selectResearchPage(records,'unmeasured'),null);assert.equal(records[0].source.observations.length,0);
});
