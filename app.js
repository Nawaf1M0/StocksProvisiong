const $=id=>document.getElementById(id), guestPortfolioKey=document.querySelector('meta[name="position-preview"]')?'position-preview-holdings-v1':'position-holdings-v1';
let key=guestPortfolioKey,portfolioPersistence=null;
let stocks=[], selected=null, currency='USD',defaultCurrency='USD',storageFailed=false;
function valid(s){return s&&typeof s.symbol==='string'&&s.symbol.trim().length>0&&s.symbol.length<=40&&['shares','average','price','target','fee','budget'].every(k=>Number.isFinite(s[k]))&&s.shares>0&&s.average>0&&s.price>0&&s.target>0&&s.fee>=0&&s.budget>=0&&(s.currency===undefined||supportedCurrencies.includes(s.currency));}
try{const saved=localStorage.getItem(key);if(saved){const data=normalizePortfolio(JSON.parse(saved));if(data.stocks.every(valid)){stocks=data.stocks;currency=defaultCurrency=data.currency;}}}catch{}
function portfolioData(){return {stocks,currency:defaultCurrency};}
$('currency').value=currency;
const money=(n,code=currency)=>new Intl.NumberFormat('en',{style:'currency',currency:code,maximumFractionDigits:2}).format(n);
const number=n=>new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(n);
function backupStatus(){
  let last;try{last=JSON.parse(localStorage.getItem(key+'-backup'));}catch{}
  const snapshot=JSON.stringify(portfolioData());
  $('backup-status').textContent=storageFailed?'Browser save failed. Export a backup now to keep this session.':!stocks.length?'Add holdings, then export a backup to keep a copy.':!last?'No backup recorded on this browser. Export JSON or CSV to protect your holdings.':last.snapshot!==snapshot?'Your holdings changed since the last backup. Export a fresh copy.':Date.now()-last.time>7*86400000?'Your last backup is over 7 days old. Consider exporting a fresh copy.':'Backup generated '+new Date(last.time).toLocaleDateString()+'. Check that the downloaded file is saved.';
}
function persist(){try{const success=portfolioPersistence?portfolioPersistence.saveLocal(portfolioData()):(localStorage.setItem(key,JSON.stringify(portfolioData())),true);if(!success)throw Error('Browser save failed');storageFailed=false;backupStatus();return true;}catch{storageFailed=true;$('storage').textContent='Browser storage is unavailable. Export a backup to keep your holdings.';backupStatus();return false;}}
function escapeText(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){
  const groups=totalsByCurrency(stocks);
  for(const [id,field] of [['cost','cost'],['value','value'],['pnl','pnl']]){
    $(id).innerHTML=Object.entries(groups).map(([code,total])=>`<span class="currency-total"><small>${code}</small><b${field==='pnl'?` style="color:${total.pnl>=0?'#278272':'#b96464'}"`:''}>${money(total[field],code)}</b></span>`).join('')||'<span class="no-total">No holdings yet</span>';
  }
  $('list').innerHTML=stocks.length?stocks.map((s,i)=>`<button class="stock ${selected===i?'active':''}" data-index="${i}" aria-pressed="${selected===i}"><span class="icon">${escapeText(s.symbol.slice(0,3).toUpperCase())}</span><span><b>${escapeText(s.symbol)} <span class="currency-badge">${s.currency}</span></b><small>${number(s.shares)} shares · Avg ${money(s.average,s.currency)}</small></span><span class="right">${money(s.shares*s.price,s.currency)}<small>Buy price ${money(s.price,s.currency)}</small></span></button>`).join(''):'<div class="empty">Your portfolio starts here.<br>Add a stock and explore your next purchase.</div>';
}
function edit(index){if(typeof resetScenarios==='function')resetScenarios();selected=index;const s=index===null?{symbol:'',currency,shares:'',average:'',price:'',target:'',fee:0,budget:0,fractional:false}:stocks[index];currency=s.currency||defaultCurrency;$('currency').value=currency;for(const k of ['symbol','shares','average','price','target','fee','budget'])$(k).value=s[k];$('fractional').checked=!!s.fractional;$('heading').textContent=index===null?'New holding':s.symbol+' purchase plan';$('remove').hidden=index===null;$('notice').textContent='';render();preview();}
function read(){const s={symbol:$('symbol').value.trim(),currency:$('currency').value,fractional:$('fractional').checked};for(const k of ['shares','average','price','target','fee','budget'])s[k]=$(k).value===''?NaN:Number($(k).value);return s;}
function preview(){
  const s=read(),r=calculate(s,s.fractional);
  const incomplete=['shares','average','price','target'].some(k=>!Number.isFinite(s[k]));
  if(incomplete){
    $('result').innerHTML='<div class="result-placeholder"><b>Your purchase plan will appear here</b><p>Enter your shares, cost, buy price, and target average above.</p></div>';
  }else if(r.error){
    $('result').innerHTML='<div class="error">'+escapeText(r.error)+'</div>';
  }else{
    $('result').innerHTML=`<strong>${number(r.buy)} <span class="shares-unit">shares to buy</span></strong><div class="result-metrics"><div><span>Current average</span><b>${money(s.average)}</b></div><div><span>Target average</span><b>${money(s.target)}</b></div><div><span>Resulting average</span><b>${money(r.result)}</b></div><div><span>Cash needed · includes fee</span><b>${money(r.cash)}</b></div><div><span>Average reduced by</span><b>${((1-r.result/s.average)*100).toFixed(2)}%</b></div><div><span>Total shares after buying</span><b>${number(s.shares+r.buy)}</b></div></div><div class="recovery"><span>Price rise needed to break even</span><div><b>${r.recoveryBefore.toFixed(2)}%</b><span aria-label="changes to"> → </span><b>${r.recoveryAfter.toFixed(2)}%</b></div><p>Before → after this purchase, measured from your entered buy price of ${money(s.price)}. Excludes selling fees and taxes.</p></div><p class="rounding-note">${s.fractional?'Fractional-share estimate; your broker may require different precision.':'Rounded up to whole shares to reach or beat your target average.'} Lowering your average increases your investment; it does not remove the existing loss.</p>`;
  }
  $('mobile-summary-value').textContent=incomplete?'Enter holding details':r.error?'Check your target':number(r.buy)+' shares · '+money(r.cash);
  renderRisk(s,r);
  $('preview').innerHTML=r.preview!==undefined?`<div class="budget-metrics"><div><span>Shares to buy</span><b>${number(r.budgetShares)}</b></div><div><span>New average</span><b>${money(r.preview)}</b></div></div><span class="budget-detail">Cash used ${money(r.budgetCost)} · Remaining ${money(s.budget-r.budgetCost)}</span>`:'Enter holding details above to explore a budget.';
}
function renderRisk(s,r){
  const otherValue=stocks.reduce((sum,stock,i)=>sum+(i===selected||stock.currency!==s.currency?0:stock.shares*stock.price),0);
  const risk=positionRisk(s,r.error?0:r.buy,r.error?0:r.cash,otherValue);
  if(!risk){$('risk-summary').textContent='Enter valid shares, average cost, and buy price to see your exposure.';return;}
  const afterAvailable=!r.error;
  const row=(label,before,after)=>`<tr><th scope="row">${label}</th><td>${before}</td><td>${afterAvailable?after:'—'}</td></tr>`;
  $('risk-summary').innerHTML=`<div class="risk-table-wrap"><table><caption class="risk-caption">At your entered buy price of ${money(s.price)}</caption><thead><tr><th scope="col">Measure</th><th scope="col">Now</th><th scope="col">After target purchase</th></tr></thead><tbody>${row('Position value',money(risk.valueBefore),money(risk.valueAfter))}${row('Invested cost',money(risk.costBefore),money(risk.costAfter))}${row('Share of '+s.currency+' holdings',risk.weightBefore.toFixed(1)+'%',risk.weightAfter.toFixed(1)+'%')}${row('Unrealized gain / loss',money(risk.pnlBefore),money(risk.pnlAfter))}</tbody></table></div><p class="risk-explanation">${afterAvailable?'Buying at the entered price leaves your existing monetary gain or loss unchanged before fees. The purchase fee increases your cost and reduces gain or increases loss.':'A valid target purchase is needed to show after-purchase exposure.'}</p><p class="risk-assumptions">Concentration compares only ${s.currency} holdings at entered prices. Holdings in other currencies are excluded; no FX conversion is performed. Cash and assets outside this app are excluded. Duplicate entries are treated as separate holdings. ${selected===null?'This unsaved holding is included in the preview.':'Unsaved edits replace this holding in the preview.'} This models the target purchase, not the fixed-budget alternative.</p>`;
}
$('form').addEventListener('input',preview);
$('form').addEventListener('submit',e=>{e.preventDefault();const s=read();if(!valid(s)){$('notice').textContent='Complete all fields with valid numbers.';return;}if(selected!==null&&stocks[selected].currency!==s.currency&&!confirm('Change this holding from '+stocks[selected].currency+' to '+s.currency+'? Amounts are not converted. Check every price, fee, and budget before saving.'))return;if(selected===null){stocks.push(s);selected=stocks.length-1;}else stocks[selected]=s;persist();edit(selected);$('notice').textContent=storageFailed?'Holding updated in this session only. Browser save failed; export a backup.':portfolioPersistence?.owner()?'Holding saved on this device; account sync status is shown above.':'Holding saved on this device.';});
$('list').addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b){edit(Number(b.dataset.index));if(matchMedia('(max-width:780px)').matches)$('heading').scrollIntoView({block:'start'});}});
$('add').onclick=()=>{edit(null);$('heading').scrollIntoView({block:'start'});$('symbol').focus();};
$('remove').onclick=()=>{if(selected===null)return;if(!confirm('Delete '+stocks[selected].symbol+(portfolioPersistence?.owner()?' from your account? This deletion will sync to your other devices.':' from this browser?')+' Export a backup first if you need to keep it.'))return;stocks.splice(selected,1);persist();edit(stocks.length?Math.min(selected,stocks.length-1):null);};
$('currency').onchange=()=>{currency=$('currency').value;if(typeof resetScenarios==='function')resetScenarios();preview();};
$('sample').onclick=()=>{const example={symbol:'EXAMPLE',currency,shares:100,average:150,price:100,target:125,fee:0,budget:5000,fractional:false};stocks.push(example);persist();edit(stocks.length-1);$('notice').textContent='Illustrative example added. Replace these with your own figures.';};
function downloadBackup(csv){
  const content=csv?exportCSV(stocks,defaultCurrency):JSON.stringify(portfolioData(),null,2);
  const blob=new Blob([content],{type:csv?'text/csv;charset=utf-8':'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='position-backup-'+new Date().toISOString().slice(0,10)+(csv?'.csv':'.json');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  try{localStorage.setItem(key+'-backup',JSON.stringify({time:Date.now(),snapshot:JSON.stringify(portfolioData())}));}catch{}
  backupStatus();
}
$('export').onclick=()=>downloadBackup(false);
$('export-csv').onclick=()=>downloadBackup(true);
$('import-button').onclick=()=>$('import').click();
$('import').onchange=async e=>{
  try{
    const file=e.target.files[0];if(!file)return;
    if(file.size>1000000)throw Error('Backup is too large (maximum 1 MB).');
    const data=importPortfolio(await file.text(),file.name.toLowerCase().endsWith('.csv'),valid,defaultCurrency);
    if(stocks.length+data.stocks.length>1000)throw Error('Import would exceed the 1000-holding limit.');
    const duplicates=data.stocks.filter((s,i)=>stocks.some(x=>x.symbol.trim().toUpperCase()===s.symbol.trim().toUpperCase())||data.stocks.slice(0,i).some(x=>x.symbol.trim().toUpperCase()===s.symbol.trim().toUpperCase())).length;
    if(!confirm('Add '+data.stocks.length+' holdings with their own currencies? Existing holdings will be kept.'+(duplicates?' '+duplicates+' imported entries repeat a symbol and will be added as separate holdings.':'')))return;
    if(!stocks.length)defaultCurrency=data.currency;stocks.push(...data.stocks);persist();edit(stocks.length-1);
    $('notice').textContent=storageFailed?'Imported into this session only. Browser save failed; export a backup.':'Import complete. Existing holdings were kept. Export a fresh backup when ready.';
  }catch(err){$('notice').textContent=err.message;}
  finally{e.target.value='';}
};
edit(stocks.length?0:null);

backupStatus();
