const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {normalizePortfolio,totalsByCurrency,exportCSV,importPortfolio}=require('./dist/data.js');
const {createAccountStore}=require('./dist/account-store.js');
const {quoteRequest}=require('./dist/quotes.js');
const sa={symbol:'2222',shares:10,average:30,price:25,target:27,fee:0,budget:500,fractional:false};
(async()=>{
 const original={stocks:[sa],currency:'SAR'};
 const migrated=normalizePortfolio(original);assert.equal(migrated.stocks[0].currency,'SAR');assert.equal(original.stocks[0].currency,undefined);
 assert.throws(()=>normalizePortfolio({stocks:[{...sa,currency:'BAD'}],currency:'USD'}),/Unsupported/);
 const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://position.test',runScripts:'outside-only'});
 try{
  const w=dom.window,d=w.document;w.HTMLElement.prototype.scrollIntoView=function(){};w.matchMedia=()=>({matches:false});w.confirm=()=>true;
  w.localStorage.setItem('position-holdings-v1',JSON.stringify(original));
  for(const file of ['calc','data','app','scenarios'])vm.runInContext(fs.readFileSync('dist/'+file+'.js','utf8'),dom.getInternalVMContext(),{filename:file});
  const input=(id,value)=>{d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('input',{bubbles:true}));};
  const currency=code=>{input('currency',code);d.getElementById('currency').dispatchEvent(new w.Event('change',{bubbles:true}));};
  const state=()=>JSON.parse(w.eval('JSON.stringify(portfolioData())'));
  assert.equal(state().stocks[0].currency,'SAR');assert.equal(d.getElementById('currency').closest('form').id,'form');
  d.getElementById('add').click();currency('USD');
  for(const [id,value]of Object.entries({symbol:'AAPL',shares:10,average:150,price:100,target:125,fee:0,budget:500}))input(id,value);
  d.getElementById('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.deepEqual(state().stocks.map(s=>s.currency),['SAR','USD']);assert.equal(state().currency,'SAR');
  const totals=totalsByCurrency(state().stocks);assert.equal(totals.SAR.cost,300);assert.equal(totals.USD.cost,1500);assert.equal(totals.SAR.value,250);assert.equal(totals.USD.value,1000);
  assert.equal(d.querySelectorAll('#cost .currency-total').length,2);assert.match(d.getElementById('cost').textContent,/SAR/);assert.match(d.getElementById('cost').textContent,/USD/);
  assert.match(d.getElementById('risk-summary').textContent,/Share of USD holdings/);assert.match(d.getElementById('risk-summary').textContent,/100.0%/);
  d.getElementById('add-scenario').click();assert.match(d.querySelector('.scenario-head').textContent,/USD/);
  const before=JSON.stringify(state());w.confirm=()=>false;currency('EUR');assert.equal(d.querySelectorAll('.scenario').length,0);
  d.getElementById('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(JSON.stringify(state()),before);
  const saved=JSON.parse(w.localStorage.getItem('position-holdings-v1'));assert.deepEqual(saved.stocks.map(s=>s.currency),['SAR','USD']);
  const parsed=importPortfolio(exportCSV(saved.stocks,saved.currency),true,s=>true,'USD');assert.deepEqual(parsed.stocks.map(s=>s.currency),['SAR','USD']);
  const json=importPortfolio(JSON.stringify(saved),false,s=>true,'EUR');assert.deepEqual(json.stocks,saved.stocks);
  assert.equal(quoteRequest('2222','SA',saved.stocks[0].currency).currency,'SAR');assert.equal(quoteRequest('AAPL','US',saved.stocks[1].currency).currency,'USD');
  assert.throws(()=>quoteRequest('AAPL','US','SAR'),/currency/);
  // Existing cloud records migrate on read; mixed currencies survive account save/reopen.
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};let remote={data:original,revision:1},shown;
  const options={storage,baseKey:'cache',normalize:normalizePortfolio,validate:x=>Array.isArray(x.stocks),readRemote:async()=>remote,saveRemote:async(_id,data,revision)=>{assert.equal(revision,remote.revision);remote={data,revision:revision+1};return remote;},onChange:v=>shown=v,onStatus:()=>{}};
  let store=createAccountStore(options);await store.switchUser('alice');assert.equal(shown.stocks[0].currency,'SAR');store.saveLocal(saved);await new Promise(r=>setImmediate(r));
  store=createAccountStore(options);await store.switchUser('alice');assert.deepEqual(shown.stocks.map(s=>s.currency),['SAR','USD']);
  console.log('Multi-currency checks passed: legacy migration, mixed-stock entry, separate totals/concentration, scenario isolation, relabel confirmation, CSV/JSON, quotes, account save/reopen.');
 }finally{dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
