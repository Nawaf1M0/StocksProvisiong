const $=id=>document.getElementById(id), key='position-holdings-v1';
let stocks=[], selected=null, currency='USD';
function valid(s){return s&&typeof s.symbol==='string'&&s.symbol.trim().length>0&&s.symbol.length<=40&&['shares','average','price','target','fee','budget'].every(k=>Number.isFinite(s[k]))&&s.shares>0&&s.average>0&&s.price>0&&s.target>0&&s.fee>=0&&s.budget>=0;}
try{const data=JSON.parse(localStorage.getItem(key));if(data&&Array.isArray(data.stocks)&&data.stocks.every(valid)){stocks=data.stocks;currency=['USD','SAR','EUR','GBP','AED'].includes(data.currency)?data.currency:'USD';}}catch{}
$('currency').value=currency;
const money=n=>new Intl.NumberFormat('en',{style:'currency',currency,maximumFractionDigits:2}).format(n);
const number=n=>new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(n);
function persist(){try{localStorage.setItem(key,JSON.stringify({stocks,currency}));}catch{$('storage').textContent='Browser storage is unavailable. Export a backup to keep your holdings.';}}
function escapeText(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){const cost=stocks.reduce((a,s)=>a+s.shares*s.average,0),value=stocks.reduce((a,s)=>a+s.shares*s.price,0);$('cost').textContent=money(cost);$('value').textContent=money(value);$('pnl').textContent=money(value-cost);$('pnl').style.color=value>=cost?'#278272':'#b96464';$('list').innerHTML=stocks.length?stocks.map((s,i)=>`<button class="stock ${selected===i?'active':''}" data-index="${i}" aria-pressed="${selected===i}"><span class="icon">${escapeText(s.symbol.slice(0,3).toUpperCase())}</span><span><b>${escapeText(s.symbol)}</b><small>${number(s.shares)} shares · Avg ${money(s.average)}</small></span><span class="right">${money(s.shares*s.price)}<small>Buy price ${money(s.price)}</small></span></button>`).join(''):'<div class="empty">Your portfolio starts here.<br>Add a stock and explore your next purchase.</div>';}
function edit(index){selected=index;const s=index===null?{symbol:'',shares:'',average:'',price:'',target:'',fee:0,budget:0,fractional:false}:stocks[index];for(const k of ['symbol','shares','average','price','target','fee','budget'])$(k).value=s[k];$('fractional').checked=!!s.fractional;$('heading').textContent=index===null?'New holding':s.symbol+' purchase plan';$('remove').hidden=index===null;$('notice').textContent='';render();preview();}
function read(){const s={symbol:$('symbol').value.trim(),fractional:$('fractional').checked};for(const k of ['shares','average','price','target','fee','budget'])s[k]=$(k).value===''?NaN:Number($(k).value);return s;}
function preview(){
  const s=read(),r=calculate(s,s.fractional);
  const incomplete=['shares','average','price','target'].some(k=>!Number.isFinite(s[k]));
  if(incomplete){
    $('result').innerHTML='<div class="result-placeholder"><b>Your purchase plan will appear here</b><p>Enter your shares, cost, buy price, and target average above.</p></div>';
  }else if(r.error){
    $('result').innerHTML='<div class="error">'+escapeText(r.error)+'</div>';
  }else{
    $('result').innerHTML=`<strong>${number(r.buy)} <span class="shares-unit">shares to buy</span></strong><div class="result-metrics"><div><span>Cash required</span><b>${money(r.cash)}</b></div><div><span>New average</span><b>${money(r.result)}</b></div><div><span>Total shares</span><b>${number(s.shares+r.buy)}</b></div></div>`;
  }
  $('preview').innerHTML=r.preview!==undefined?`<div class="budget-metrics"><div><span>Shares to buy</span><b>${number(r.budgetShares)}</b></div><div><span>New average</span><b>${money(r.preview)}</b></div></div><span class="budget-detail">Cash used ${money(r.budgetCost)} · Remaining ${money(s.budget-r.budgetCost)}</span>`:'Enter holding details above to explore a budget.';
}
$('form').addEventListener('input',preview);
$('form').addEventListener('submit',e=>{e.preventDefault();const s=read();if(!valid(s)){$('notice').textContent='Complete all fields with valid numbers.';return;}if(selected===null){stocks.push(s);selected=stocks.length-1;}else stocks[selected]=s;persist();edit(selected);$('notice').textContent='Holding saved.';});
$('list').addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b)edit(Number(b.dataset.index));});
$('add').onclick=()=>{edit(null);$('symbol').focus();};
$('remove').onclick=()=>{if(selected===null)return;stocks.splice(selected,1);persist();edit(stocks.length?Math.min(selected,stocks.length-1):null);};
$('currency').onchange=()=>{currency=$('currency').value;persist();render();preview();};
$('sample').onclick=()=>{const example={symbol:'EXAMPLE',shares:100,average:150,price:100,target:125,fee:0,budget:5000,fractional:false};stocks.push(example);persist();edit(stocks.length-1);$('notice').textContent='Illustrative example added. Replace these with your own figures.';};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({stocks,currency},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='position-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import-button').onclick=()=>$('import').click();
$('import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Backup is too large.');const data=JSON.parse(await file.text());if(!Array.isArray(data.stocks)||!data.stocks.every(valid)||data.stocks.length>1000)throw Error('Invalid portfolio backup.');stocks.push(...data.stocks);persist();edit(stocks.length?stocks.length-1:null);$('notice').textContent='Backup imported. Holdings were added to your portfolio.';}catch(err){$('notice').textContent=err.message;}e.target.value='';};
edit(stocks.length?0:null);
