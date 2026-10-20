const supportedCurrencies=['USD','SAR','EUR','GBP','AED'];
function normalizePortfolio(data,fallback='USD'){
  if(!data||!Array.isArray(data.stocks))throw Error('Invalid portfolio data.');
  const legacy=data.currency===undefined?fallback:data.currency;
  if(!supportedCurrencies.includes(legacy))throw Error('Unsupported currency.');
  const stocks=data.stocks.map(s=>{
    if(!s||typeof s!=='object'||Array.isArray(s))throw Error('Invalid holding.');
    const currency=s.currency===undefined?legacy:s.currency;
    if(!supportedCurrencies.includes(currency))throw Error('Unsupported stock currency.');
    return {...s,currency};
  });
  // Keep the legacy envelope field for existing database constraints and old backups.
  return {...data,stocks,currency:legacy};
}
function totalsByCurrency(stocks){
  const groups={};
  for(const s of stocks){const g=groups[s.currency]||(groups[s.currency]={cost:0,value:0,pnl:0});g.cost+=s.shares*s.average;g.value+=s.shares*s.price;g.pnl=g.value-g.cost;}
  return groups;
}
const portfolioFields=['symbol','shares','average','price','target','fee','budget','fractional','currency'];
function csvRows(text){
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell||closed)throw Error('Invalid CSV quotes.');quoted=true;}
    else if(c===','||c==='\n'||c==='\r'){
      row.push(cell);cell='';closed=false;
      if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}
    }else{if(closed)throw Error('Unexpected text after CSV quote.');cell+=c;}
  }
  if(quoted)throw Error('Unclosed CSV quote.');
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  return rows;
}
function exportCSV(stocks,currency){
  return [portfolioFields,...stocks.map(s=>portfolioFields.map(k=>k==='currency'?(s.currency||currency):k==='symbol'&&/^[=+\-@\t\r']/.test(s.symbol)?"'"+s.symbol:s[k]))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
function importPortfolio(text,isCSV,validate,currentCurrency){
  let data;
  if(isCSV){
    const rows=csvRows(text);if(rows.length<2)throw Error('CSV must contain headers and at least one holding.');
    const headers=rows.shift().map(v=>v.trim());
    if(headers.length!==portfolioFields.length||new Set(headers).size!==headers.length||!portfolioFields.every(k=>headers.includes(k)))throw Error('CSV headers must be: '+portfolioFields.join(', '));

    const stocks=rows.map((row,i)=>{
      if(row.length!==headers.length)throw Error('Wrong column count on data row '+(i+1)+'.');
      const record=Object.fromEntries(headers.map((h,j)=>[h,row[j]]));
      if(!['true','false'].includes(record.fractional))throw Error('fractional must be true or false on data row '+(i+1)+'.');
      for(const key of ['shares','average','price','target','fee','budget']){if(!record[key].trim())throw Error('Missing '+key+' on data row '+(i+1)+'.');record[key]=Number(record[key]);}
      record.fractional=record.fractional==='true';if(/^'[=+\-@\t\r']/.test(record.symbol))record.symbol=record.symbol.slice(1);return record;
    });
    data={stocks,currency:stocks[0]?.currency||currentCurrency};
  }else data=JSON.parse(text);
  data=normalizePortfolio(data,currentCurrency);
  if(!data||!Array.isArray(data.stocks)||!data.stocks.length||data.stocks.length>1000||!data.stocks.every(s=>validate(s)&&(s.fractional===undefined||typeof s.fractional==='boolean')))throw Error('Invalid backup. Use 1–1000 valid holdings.');
  const currency=data.currency||currentCurrency;
  if(!['USD','SAR','EUR','GBP','AED'].includes(currency))throw Error('Unsupported currency.');
  return {stocks:data.stocks.map(s=>({...s,fractional:!!s.fractional})),currency};
}
if(typeof module!=='undefined')module.exports={csvRows,exportCSV,importPortfolio,normalizePortfolio,totalsByCurrency,supportedCurrencies};
