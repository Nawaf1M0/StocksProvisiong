// Exercise the real HTML and production event handlers; no auth or quote network calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const {JSDOM}=require('jsdom');
const base={symbol:'EXAMPLE',currency:'USD',shares:100,average:150,price:100,target:125,fee:0,budget:5000,fractional:false};
function setup(t){
  const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://position.test/',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,$=s=>d.querySelector(s);
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.matchMedia=()=>({matches:false});
  const saved=JSON.stringify({stocks:[base,{...base,symbol:'OTHER',shares:20}],currency:'USD'});
  w.localStorage.setItem('position-holdings-v1',saved);
  for(const file of ['calc','data','app','scenarios'])vm.runInContext(fs.readFileSync(`dist/${file}.js`,'utf8'),dom.getInternalVMContext(),{filename:`dist/${file}.js`});
  const input=(selector,value)=>{const el=$(selector);assert.ok(el,selector);if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const click=selector=>{const el=$(selector);assert.ok(el,selector);el.click();};
  const card=id=>`[data-scenario="${id}"]`;
  const edit=(id,field,value)=>input(`${card(id)} [data-field="${field}"]`,value);
  const metrics=id=>Object.fromEntries([...$(`${card(id)} .scenario-output`).querySelectorAll('dl > div')].map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
  const unchanged=()=>{assert.equal(w.localStorage.getItem('position-holdings-v1'),saved);assert.deepEqual(JSON.parse(w.eval('JSON.stringify(stocks)')),[base,{...base,symbol:'OTHER',shares:20}]);};
  return {w,$,input,click,edit,metrics,unchanged,card};
}
test('create, compare three independent scenarios, remove and replace',t=>{
  const h=setup(t);assert.match(h.$('#scenario-list').textContent,/add a scenario/);
  h.click('#add-scenario');h.edit(1,'price',90);h.click('#add-scenario');h.click('#add-scenario');
  assert.equal(h.$('#add-scenario').disabled,true);h.w.eval("document.getElementById('add-scenario').onclick()");
  assert.equal(h.$('#scenario-list').children.length,3);
  assert.equal(h.metrics(1)['Shares needed for target'],'72');
  assert.equal(h.metrics(2)['Shares needed for target'],'100');
  h.click('[data-remove="2"]');assert.equal(h.$('[data-scenario="2"]'),null);assert.equal(h.$('#add-scenario').disabled,false);
  h.click('#add-scenario');assert.ok(h.$('[data-scenario="4"]'));assert.equal(h.metrics(1)['Shares needed for target'],'72');
  h.click('[data-remove="1"]');h.click('[data-remove="3"]');h.click('[data-remove="4"]');
  assert.equal(h.$('[data-scenario]'),null);assert.equal(h.$('#add-scenario').disabled,false);
  h.unchanged();
});
test('fees, budget boundaries, fractional shares, target status and live holding edits',t=>{
  const h=setup(t);h.click('#add-scenario');
  assert.equal(h.metrics(1)['Cash needed, including fee'],'$10,000.00');assert.equal(h.metrics(1)['Resulting average'],'$133.33');
  assert.match(h.$('.scenario-status').textContent,/does not reach/);
  h.edit(1,'fee',10);h.edit(1,'budget',10010);
  assert.equal(h.metrics(1)['Shares needed for target'],'101');assert.equal(h.metrics(1)['Shares to buy'],'100');
  assert.equal(h.metrics(1)['Cash used'],'$10,010.00');assert.match(h.$('.scenario-status').textContent,/does not reach/);
  h.edit(1,'budget',10110);assert.match(h.$('.scenario-status').textContent,/^Budget reaches/);
  h.edit(1,'fractional',true);h.edit(1,'budget',10050);
  assert.equal(h.metrics(1)['Shares needed for target'],'100.4');assert.equal(h.metrics(1)['Shares to buy'],'100.4');
  assert.equal(h.metrics(1)['Cash remaining'],'$0.00');assert.match(h.$('.scenario-status').textContent,/^Budget reaches/);
  for(const budget of [0,5,10]){h.edit(1,'budget',budget);assert.equal(h.metrics(1)['Shares to buy'],'0');assert.equal(h.metrics(1)['Cash used'],'$0.00');assert.equal(h.metrics(1)['Resulting average'],'$150.00');}
  h.edit(1,'target',130);h.input('#shares',200);assert.equal(h.metrics(1)['Shares needed for target'],'133.666667');
  h.input('#average',160);assert.equal(h.metrics(1)['Shares needed for target'],'200.333333');
  h.$('#currency').value='SAR';h.$('#currency').dispatchEvent(new h.w.Event('change',{bubbles:true}));assert.equal(h.$('[data-scenario]'),null);h.click('#add-scenario');assert.match(h.metrics(2)['Cash used'],/SAR/);
});
test('invalid input is visible and cannot overwrite planner; recovery and unreachable targets',t=>{
  const h=setup(t);h.click('#add-scenario');
  for(const [field,value] of [['price',''],['price',0],['price',-1],['target',0],['budget',-1],['fee',-1],['fee',''],['budget',''],['target','1e309']]){
    h.edit(1,field,value);assert.ok(h.$('.scenario-warning'));assert.equal(h.$('.scenario-status'),null);
    h.click('[data-apply="1"]');assert.match(h.$('#scenario-notice').textContent,/Correct/);assert.equal(h.$('#price').value,'100');
    h.edit(1,field,base[field]);
  }
  h.edit(1,'price',130);assert.match(h.$('.scenario-warning').textContent,/cannot be reached/);assert.match(h.$('.scenario-status').textContent,/does not reach/);
  h.edit(1,'target',150);assert.match(h.$('.scenario-warning').textContent,/already/);
  h.edit(1,'price',100);h.edit(1,'target',125);assert.equal(h.$('.scenario-warning'),null);
  h.input('#shares',0);h.click('#add-scenario');assert.equal(h.$('#scenario-list').children.length,1);assert.match(h.$('#scenario-notice').textContent,/valid holding/);
  h.unchanged();
});
test('apply copies purchase settings only; switching holdings clears temporary scenarios',t=>{
  const h=setup(t);h.click('#add-scenario');h.click('#add-scenario');
  for(const [field,value] of Object.entries({price:80,target:120,budget:7012,fee:12,fractional:true}))h.edit(2,field,value);
  h.click('[data-apply="2"]');
  for(const [field,value] of Object.entries({price:80,target:120,budget:7012,fee:12}))assert.equal(h.$('#'+field).value,String(value));
  assert.equal(h.$('#fractional').checked,true);assert.equal(h.$('#symbol').value,'EXAMPLE');assert.equal(h.$('#shares').value,'100');assert.equal(h.$('#average').value,'150');
  assert.match(h.$('#notice').textContent,/Review and save/);assert.match(h.$('#result').textContent,/75.3/);h.unchanged();
  h.click('[data-index="1"]');assert.equal(h.$('[data-scenario]'),null);assert.equal(h.$('#add-scenario').disabled,false);assert.equal(h.$('#symbol').value,'OTHER');
  h.click('#add-scenario');h.click('#add');assert.equal(h.$('[data-scenario]'),null);h.unchanged();
});
test('decimal cash boundary buys all affordable whole shares',t=>{
  const h=setup(t);h.input('#average',0.3);h.input('#price',0.1);h.input('#target',0.2);h.input('#budget',0.3);h.click('#add-scenario');
  assert.equal(h.metrics(1)['Shares to buy'],'3');assert.equal(h.metrics(1)['Cash used'],'$0.30');assert.equal(h.metrics(1)['Cash remaining'],'$0.00');
  h.edit(1,'budget',0.2999999);assert.equal(h.metrics(1)['Shares to buy'],'2');
  h.edit(1,'fee',0.1);h.edit(1,'budget',0.4);assert.equal(h.metrics(1)['Shares to buy'],'3');
});
