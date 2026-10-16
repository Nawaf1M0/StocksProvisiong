const assert=require('node:assert/strict');
const {csvRows,exportCSV,importPortfolio}=require('./dist/data.js');
const valid=s=>typeof s.symbol==='string'&&s.symbol.trim().length>0&&s.symbol.length<=40&&['shares','average','price','target','fee','budget'].every(k=>Number.isFinite(s[k]))&&s.shares>0&&s.average>0&&s.price>0&&s.target>0&&s.fee>=0&&s.budget>=0;
const holding={symbol:'A,"B"\nC',shares:10.5,average:150,price:100,target:125,fee:2,budget:500,fractional:true};
const parse=(s,csv=true)=>importPortfolio(s,csv,valid,'USD');
assert.deepEqual(parse(exportCSV([holding],'SAR')),{stocks:[holding],currency:'SAR'});
assert.deepEqual(csvRows('\uFEFFa,b\r\n"x,y","z"\r\n'),[['a','b'],['x,y','z']]);
assert.throws(()=>csvRows('"unclosed'));
assert.throws(()=>csvRows('"closed"text'));
assert.throws(()=>parse('symbol,shares\nA,2'));
assert.throws(()=>parse(exportCSV([{...holding,shares:''}],'USD')));
assert.throws(()=>parse(exportCSV([{...holding,fractional:'yes'}],'USD')));
assert.throws(()=>parse(exportCSV([holding],'USD')+'\r\n'+exportCSV([holding],'SAR').split('\r\n').slice(1).join('\r\n')));
assert.deepEqual(parse(JSON.stringify({stocks:[holding],currency:'EUR'}),false).stocks,[holding]);
assert.throws(()=>parse(JSON.stringify({stocks:[{...holding,price:-1}]}),false));
for(const symbol of ['=SUM(A1)','+TEST','-TEST','@TEST',"'TEST"]){const csv=exportCSV([{...holding,symbol}],'USD');assert.ok(csv.includes('"\''+symbol));assert.equal(parse(csv).stocks[0].symbol,symbol);}
console.log('Data checks passed: CSV round trips, quotes, BOM, malformed rows, currencies, JSON, spreadsheet text escaping.');
