const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base={symbol:'AAPL',shares:10,average:150,price:100,target:125,fee:0,budget:500,fractional:false};
const clone=x=>JSON.parse(JSON.stringify(x));
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
(async()=>{
 const db=new Map([['alice',{data:{stocks:[base],currency:'USD'},revision:1}],['bob',{data:{stocks:[{...base,symbol:'BOB'}],currency:'USD'},revision:1}]]);
 let identity=null;
 const windows=[];
 function browser(saved={}){
  const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://nawaf1m0.github.io/StocksProvisiong/',runScripts:'outside-only'});windows.push(dom.window);
  const w=dom.window,d=w.document;w.HTMLElement.prototype.scrollIntoView=function(){};w.matchMedia=()=>({matches:false});w.confirm=()=>true;
  for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);
  w.createCloudClient=()=>({currentUser:()=>identity,restore:async()=>identity,signInPassword:async email=>(identity={id:email.split('@')[0],email}),signOut:async()=>{identity=null;},clear:()=>{identity=null;},read:async(_env,id)=>{assert.equal(id,identity.id);return clone(db.get(id)||null);},save:async(_env,data,revision,id)=>{assert.equal(id,identity.id);assert.equal(revision,db.get(id)?.revision||0);const row={data:clone(data),revision:revision+1};db.set(id,row);return clone(row);}});
  for(const file of ['calc','data','app','scenarios','account-store','cloud'])vm.runInContext(fs.readFileSync('dist/'+file+'.js','utf8'),dom.getInternalVMContext(),{filename:file});
  return {w,d,state:()=>JSON.parse(w.eval('JSON.stringify({stocks,currency})')),cache:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)];}))};
 }
 const guest={stocks:[{...base,symbol:'LEGACY'}],currency:'USD'};
 let h=browser({'position-holdings-v1':JSON.stringify(guest)});await settle();
 h.d.getElementById('cloud-email').value='alice@example.com';h.d.getElementById('cloud-password').value='password';h.d.getElementById('cloud-signin-form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 assert.equal(h.state().stocks[0].symbol,'AAPL');assert.equal(h.d.getElementById('cloud-actions').hidden,false);assert.equal(h.d.getElementById('cloud-import-guest').hidden,false);
 h.d.getElementById('shares').value='20';h.d.getElementById('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(db.get('alice').data.stocks[0].shares,20);
 assert.equal(JSON.parse(h.w.localStorage.getItem('position-holdings-v1')).stocks[0].symbol,'LEGACY');
 const saved=h.cache();h.w.close();h=browser(saved);await settle();assert.equal(h.state().stocks[0].shares,20);assert.equal(h.d.getElementById('cloud-auth').hidden,true);
 h.d.getElementById('cloud-signout').click();await settle();assert.equal(h.state().stocks[0].symbol,'LEGACY');
 h.d.getElementById('cloud-email').value='bob@example.com';h.d.getElementById('cloud-password').value='password';h.d.getElementById('cloud-signin-form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(h.state().stocks[0].symbol,'BOB');assert.equal(db.get('alice').data.stocks[0].shares,20);
 for(const w of windows)w.close();console.log('Account UI checks passed: real form saves autosync, automatic sign-in restore, account switching, sign-out, and legacy guest preservation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
