import test from 'node:test';
import assert from 'node:assert/strict';
import { cardIdentity, ownershipIdentity, createCollection, quantity, variantQuantity, setQuantity, addCopies, status, completion, matchCards, exportBackup, importBackup } from '../src/domain/collection.js';
import { loadCollection, saveCollection, STORAGE_KEY } from '../src/domain/storage.js';
const release = (key, language='en', region='international') => ({ id:`${region}:${key}:${language}`,game:'pokemon',region,releaseKey:key,language,name:key,printedTotal:'102',checklist:{complete:true,expectedTotal:2} });
const releases = [release('base-set-1999'),release('jungle-1999'),release('base-set-1999','zh-Hans','cn')];
const makeCard=(r,n)=>{const c={game:r.game,region:r.region,releaseKey:r.releaseKey,language:r.language,releaseId:r.id,collectorNumber:n,name:`Card ${n}`,variants:[{id:'unspecified',label:'Finish not specified'},{id:'holo',label:'Holo'}],provider:{name:'fixture',id:'external'}};return {...c,id:cardIdentity(c)};};
const cards=[makeCard(releases[0],'1'),makeCard(releases[0],'2'),makeCard(releases[1],'1'),makeCard(releases[2],'1')];
const fresh=()=>createCollection({releases,cards});
test('identity isolates release, regional release, language and opaque collector number',()=>{
 assert.equal(new Set(cards.map(c=>c.id)).size,4);
 assert.notEqual(cardIdentity({...cards[0],collectorNumber:'001'}),cards[0].id);
 assert.notEqual(ownershipIdentity(cards[0].id,'holo'),ownershipIdentity(cards[0].id,'unspecified'));
 assert.equal(cardIdentity({...cards[0],provider:{id:'changed'}}),cards[0].id);
});
test('quantity > zero owns, duplicates report total copies, zero keeps metadata',()=>{
 const initial=fresh(),s=setQuantity(initial,cards[0].id,'holo',3);
 assert.deepEqual(status(s,cards[0].id),{owned:true,needed:false,duplicate:true,copies:3,badge:'×3'});
 assert.equal(quantity(initial,cards[0].id),0);
 const zero=setQuantity(s,cards[0].id,'holo',0);
 assert.equal(status(zero,cards[0].id).needed,true);assert.deepEqual(zero.reference,s.reference);
 assert.equal(zero.quantities[ownershipIdentity(cards[0].id,'holo')],0);
});
test('variants store separate quantities; completion counts one unique card',()=>{
 let s=setQuantity(fresh(),cards[0].id,'holo',3);s=setQuantity(s,cards[0].id,'unspecified',2);
 assert.equal(variantQuantity(s,cards[0].id,'holo'),3);assert.equal(quantity(s,cards[0].id),5);
 assert.equal(completion(s,releases[0].id).owned,1);assert.equal(completion(s,releases[0].id).percent,50);
});
test('only a complete verified reference can claim 100 percent',()=>{
 let s=addCopies(fresh(),cards.slice(0,2).map(c=>({cardId:c.id,variantId:'holo'})));
 assert.equal(completion(s,releases[0].id).completed,true);
 s.reference.releases[0].checklist.complete=false;
 assert.equal(completion(s,releases[0].id).percent,null);assert.equal(completion(s,releases[0].id).completed,false);
 s.reference.releases[0].checklist.complete=true;s.reference.releases[0].checklist.expectedTotal=3;
 assert.equal(completion(s,releases[0].id).percent,null);
});
test('invalid quantities and unknown identities cannot mutate a collection',()=>{
 const s=fresh();for(const n of [-1,1.5,NaN,Infinity,1000,'1'])assert.throws(()=>setQuantity(s,cards[0].id,'holo',n));
 assert.throws(()=>setQuantity(s,cards[0].id,'fake',1));assert.throws(()=>setQuantity(s,'fake','holo',1));
 assert.throws(()=>addCopies(setQuantity(s,cards[0].id,'holo',999),[{cardId:cards[0].id,variantId:'holo'}]));
 assert.equal(quantity(s,cards[0].id),0);
});
test('authoritative matching requires release and language; checks denominator',()=>{
 const ref=fresh().reference;
 assert.equal(matchCards(ref,{raw:'1'}).status,'context');
 assert.deepEqual(matchCards(ref,{raw:'001/102',releaseId:releases[0].id,language:'en'}).candidates,[cards[0].id]);
 assert.equal(matchCards(ref,{raw:'1/103',releaseId:releases[0].id,language:'en'}).status,'missing');
 assert.equal(matchCards(ref,{raw:'1',releaseId:releases[0].id,language:'zh-Hans'}).status,'context');
 assert.equal(matchCards(ref,{raw:'1?',releaseId:releases[0].id,language:'en'}).status,'invalid');
});
test('lossless backup includes reference, zeroes, variants, pending review and extension metadata',()=>{
 let s=setQuantity(fresh(),cards[0].id,'holo',0);s=setQuantity(s,cards[0].id,'unspecified',3);
 s.batch=[{raw:'001',i:0,candidates:[cards[0].id],chosen:cards[0].id,variantId:'holo'}];s.extra={futureNotes:['keep me']};
 assert.deepEqual(importBackup(exportBackup(s)),s);
 const storage={value:null,getItem(){return this.value;},setItem(k,v){assert.equal(k,STORAGE_KEY);this.value=v;}};
 saveCollection(storage,s);assert.deepEqual(loadCollection(storage,fresh()).state,s);
});
test('invalid imports fail atomically; corrupted storage is preserved for recovery',()=>{
 const s=fresh();assert.throws(()=>importBackup('{'));
 assert.throws(()=>importBackup(JSON.stringify({...s,version:2})));
 assert.throws(()=>importBackup(JSON.stringify({...s,quantities:{orphan:1}})));
 const duplicate=structuredClone(s);duplicate.reference.cards.push(duplicate.reference.cards[0]);assert.throws(()=>importBackup(JSON.stringify(duplicate)));
 const storage={getItem(){return '{broken';},setItem(){throw Error('must not write');}};
 const result=loadCollection(storage,s);assert.ok(result.error);assert.equal(result.raw,'{broken');assert.deepEqual(result.state,s);
 assert.throws(()=>saveCollection({setItem(){throw Error('QuotaExceeded');}},s),/QuotaExceeded/);
});
