const assert=require('node:assert/strict');
const {calculate}=require('./dist/calc.js');
const base={shares:100,average:150,price:100,target:125,fee:0,budget:5000};
let r=calculate(base);assert.equal(r.buy,100);assert.equal(r.cash,10000);assert.equal(r.result,125);assert.equal(r.budgetShares,50);assert.ok(Math.abs(r.preview-133.3333333333)<1e-8);
r=calculate({...base,fee:10});assert.equal(r.buy,101);assert.ok(r.result<=125);assert.ok((15000+100*100+10)/200>125);
assert.ok(calculate({...base,target:100}).error);assert.ok(calculate({...base,price:130}).error);assert.ok(calculate({...base,shares:0}).error);
r=calculate({...base,fee:10,budget:5});assert.equal(r.budgetShares,0);assert.equal(r.budgetCost,0);assert.equal(r.preview,150);
r=calculate({...base,target:126},true);assert.ok(Math.abs(r.result-126)<1e-10);
console.log('Calculator checks passed: target, rounding, fees, budget, invalid and unreachable inputs.');

r=calculate(base);assert.equal(r.recoveryBefore,50);assert.equal(r.recoveryAfter,25);
r=calculate({...base,fee:10});assert.ok(Math.abs(r.recoveryAfter-(r.result/100-1)*100)<1e-10);
console.log("Break-even checks passed: 50% before, 25% after; fees included.");
