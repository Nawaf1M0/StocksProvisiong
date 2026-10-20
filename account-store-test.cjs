const assert=require('node:assert/strict');
const {createAccountStore}=require('./dist/account-store.js');
const base={stocks:[{symbol:'AAPL',shares:10}],currency:'USD'};
const clone=x=>JSON.parse(JSON.stringify(x));
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const valid=x=>x&&Array.isArray(x.stocks)&&['USD','SAR'].includes(x.currency);
const tick=()=>new Promise(r=>setImmediate(r));
function setup(local,db,extra={}){
 let shown,lastStatus;const calls=[];
 const api={storage:local,baseKey:'portfolio',validate:valid,
 readRemote:async id=>db.get(id)?clone(db.get(id)):null,
 saveRemote:async(id,data,revision)=>{calls.push({id,data:clone(data),revision});const previous=db.get(id);if((previous?.revision||0)!==revision)throw Error('Conflict');const row={data:clone(data),revision:revision+1};db.set(id,row);return row;},
 onChange:(data,key,owner)=>shown={data,key,owner},onStatus:s=>lastStatus=s,...extra};
 const store=createAccountStore(api);return {store,calls,shown:()=>shown,status:()=>lastStatus};
}
(async()=>{
 const local=storage(),db=new Map([['alice',{data:base,revision:1}],['bob',{data:{stocks:[{symbol:'OTHER',shares:5}],currency:'SAR'},revision:3}]]);
 local.setItem('portfolio',JSON.stringify({stocks:[{symbol:'GUEST'}],currency:'USD'}));
 const first=setup(local,db);await first.store.switchUser('alice');assert.equal(first.shown().data.stocks[0].symbol,'AAPL');
 const changed={stocks:[{symbol:'AAPL',shares:20}],currency:'USD'};first.store.saveLocal(changed);await tick();assert.deepEqual(db.get('alice').data,changed);
 assert.equal(first.store.hasPending(),false);assert.equal(first.calls[0].id,'alice');
 // A fresh instance models reopening after a publish; database and stable keys survive.
 const afterPublish=setup(local,db);await afterPublish.store.switchUser('alice');assert.deepEqual(afterPublish.shown().data,changed);
 await first.store.switchUser('bob');assert.equal(first.shown().data.currency,'SAR');assert.equal(first.shown().key,'portfolio:user:bob');
 assert.equal(JSON.parse(local.getItem('portfolio:user:alice')).stocks[0].shares,20);
 await first.store.switchUser(null);assert.equal(first.shown().data.stocks[0].symbol,'GUEST');assert.equal(first.shown().owner,null);
 assert.equal(first.store.guest().stocks[0].symbol,'GUEST');
 // Offline pending changes are restored and sent after reconnect, using the old revision.
 let offline=true;const offlineStore=setup(local,db,{saveRemote:async(id,data,revision)=>{if(offline)throw Error('Offline');assert.equal(revision,2);const row={data:clone(data),revision:3};db.set(id,row);return row;}});
 await offlineStore.store.switchUser('alice');const pending={stocks:[{symbol:'AAPL',shares:30}],currency:'USD'};offlineStore.store.saveLocal(pending);await tick();assert.equal(offlineStore.store.hasPending(),true);
 const reopen=setup(local,db,{saveRemote:async(id,data,revision)=>{assert.equal(revision,2);const row={data:clone(data),revision:3};db.set(id,row);return row;}});
 await reopen.store.switchUser('alice');assert.deepEqual(db.get('alice').data,pending);assert.equal(reopen.store.hasPending(),false);
 // Conflicts keep the pending local copy and never silently replace newer cloud data.
 db.set('alice',{data:changed,revision:4});offlineStore.store.saveLocal(pending);await offlineStore.store.retry();assert.equal(offlineStore.store.hasPending(),true);assert.deepEqual(db.get('alice').data,changed);assert.match(offlineStore.status(),/Another device/);
 await offlineStore.store.reload();assert.deepEqual(offlineStore.shown().data,changed);assert.ok(local.getItem('portfolio:user:alice:recovery'));
 // An old account response cannot overwrite the next account's screen or cache.
 let resolveRead;const slow=setup(local,db,{readRemote:async id=>id==='alice'?new Promise(r=>resolveRead=r):clone(db.get(id))});
 const old=slow.store.switchUser('alice');await slow.store.switchUser('bob');resolveRead({data:base,revision:1});await old;assert.equal(slow.shown().owner,'bob');assert.equal(slow.shown().data.currency,'SAR');
 // Edits during an in-flight save are serialized and not marked clean prematurely.
 let finish;const serialDb=new Map(),serialStorage=storage(),snapshots=[];let saves=0;
 const serial=setup(serialStorage,serialDb,{saveRemote:async(id,data,revision)=>{saves++;snapshots.push(clone(data));if(saves===1)await new Promise(r=>finish=r);return {data:clone(data),revision:revision+1};}});
 await serial.store.switchUser('new');serial.store.saveLocal(base);serial.store.saveLocal(changed);finish();await tick();assert.equal(saves,2);assert.equal(serial.store.hasPending(),false);assert.deepEqual(snapshots,[base,changed]);assert.equal(JSON.parse(serialStorage.getItem('portfolio:user:new')).stocks[0].shares,20);
 // A lost acknowledgement is reconciled without another write when cloud data matches.
 const lostStorage=storage();lostStorage.setItem('portfolio:user:alice',JSON.stringify({...changed,_sync:{revision:1,dirty:true}}));
 const lost=setup(lostStorage,new Map([['alice',{data:changed,revision:2}]]));await lost.store.switchUser('alice');assert.equal(lost.store.hasPending(),false);assert.equal(lost.calls.length,0);
 // Guest data is never automatically claimed by a new account.
 const fresh=setup(local,new Map());await fresh.store.switchUser('new-account');assert.equal(fresh.shown().data.stocks.length,0);assert.equal(fresh.calls.length,0);assert.ok(local.getItem('portfolio'));
 console.log('Account storage checks passed: account isolation, automatic restore/save, publish survival, offline queue, conflicts, recovery, account-switch races, serialized edits, guest preservation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
