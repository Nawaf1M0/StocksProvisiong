let scenarios=[];
let scenarioId=0;
function resetScenarios(){scenarios=[];if($('scenario-list'))renderScenarios();}
function renderScenarios(){
  $('scenario-list').innerHTML=scenarios.length?scenarios.map(s=>`<article class="scenario" data-scenario="${s.id}"><div class="scenario-head"><h3>Scenario ${s.id} · ${s.currency}</h3><button class="quiet danger" type="button" data-remove="${s.id}" aria-label="Remove scenario ${s.id}">Remove</button></div><div class="fields">${[['price','Buy price'],['target','Target average'],['budget','Cash budget'],['fee','Purchase fee']].map(([key,label])=>`<label>${label}<input type="number" inputmode="decimal" min="${key==='price'||key==='target'?'0.000001':'0'}" step="any" data-field="${key}" value="${s[key]}"></label>`).join('')}</div><label class="check"><input type="checkbox" data-field="fractional" ${s.fractional?'checked':''}> Allow fractional shares</label><div class="scenario-output" aria-live="polite"></div><button class="quiet" type="button" data-apply="${s.id}">Use in purchase planner</button></article>`).join(''):'<div class="empty">Enter a holding above, then add a scenario.<br>Try a different buy price or a smaller budget.</div>';
  $('add-scenario').disabled=scenarios.length>=3;
  updateScenarios();
}
function updateScenarios(){
  const holding=read();
  for(const s of scenarios){
    const input={...holding,...s},r=calculate(input,s.fractional);
    const output=$('scenario-list').querySelector(`[data-scenario="${s.id}"] .scenario-output`);
    let target=r.error?`<p class="scenario-warning">${escapeText(r.error)}</p>`:`<dl><div><dt>Shares needed for target</dt><dd>${number(r.buy)}</dd></div><div><dt>Cash needed, including fee</dt><dd>${money(r.cash,s.currency)}</dd></div><div><dt>Resulting average</dt><dd>${money(r.result,s.currency)}</dd></div></dl>`;
    const budget=r.preview!==undefined?`<h4>Within your budget</h4><dl><div><dt>Shares to buy</dt><dd>${number(r.budgetShares)}</dd></div><div><dt>Resulting average</dt><dd>${money(r.preview,s.currency)}</dd></div><div><dt>Cash used</dt><dd>${money(r.budgetCost,s.currency)}</dd></div><div><dt>Cash remaining</dt><dd>${money(s.budget-r.budgetCost,s.currency)}</dd></div></dl><p class="scenario-status">${r.preview<=s.target+1e-10?'Budget reaches your target average.':'Budget does not reach your target average.'}</p>`:'';
    output.innerHTML='<h4>To reach your target</h4>'+target+budget;
  }
}
$('add-scenario').onclick=()=>{
  const s=read();
  if(!valid({...s,symbol:s.symbol||'Scenario'})){$('scenario-notice').textContent='Complete valid holding details above before adding a scenario.';return;}
  if(scenarios.length>=3)return;
  scenarios.push({id:++scenarioId,currency:s.currency,price:s.price,target:s.target,budget:s.budget,fee:s.fee,fractional:s.fractional});
  $('scenario-notice').textContent='Scenario added. Adjust its values to compare outcomes.';
  renderScenarios();
};
$('scenario-list').addEventListener('input',e=>{
  const field=e.target.dataset.field;if(!field)return;
  const s=scenarios.find(s=>s.id===Number(e.target.closest('[data-scenario]').dataset.scenario));
  s[field]=field==='fractional'?e.target.checked:e.target.value===''?NaN:Number(e.target.value);
  updateScenarios();
});
$('scenario-list').addEventListener('click',e=>{
  const remove=e.target.closest('[data-remove]'),apply=e.target.closest('[data-apply]');
  if(remove){scenarios=scenarios.filter(s=>s.id!==Number(remove.dataset.remove));renderScenarios();}
  if(apply){
    const s=scenarios.find(s=>s.id===Number(apply.dataset.apply));
    if(!valid({...read(),...s,symbol:read().symbol||'Scenario'})){$('scenario-notice').textContent='Correct the scenario values before applying it.';return;}
    for(const key of ['price','target','budget','fee'])$(key).value=s[key];
    $('fractional').checked=s.fractional;preview();updateScenarios();
    $('notice').textContent='Scenario applied. Review and save the holding to keep these values.';
    $('heading').scrollIntoView({behavior:'smooth',block:'start'});
  }
});
$('form').addEventListener('input',updateScenarios);
$('currency').addEventListener('change',updateScenarios);
renderScenarios();
