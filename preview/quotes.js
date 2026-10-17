// Provider-neutral checks applied before an external quote can enter a plan.
function quoteRequest(symbol,market,portfolioCurrency){
  const normalized=String(symbol).trim().toUpperCase();
  if(!['SA','US'].includes(market))throw Error('Choose Saudi or US stocks.');
  const currency=market==='SA'?'SAR':'USD';
  if(portfolioCurrency!==currency)throw Error('This quote is in '+currency+'. Use a portfolio in that currency; changing a label does not convert your holdings.');
  if(market==='SA'&&!/^\d{4}$/.test(normalized))throw Error('Use a four-digit Saudi stock symbol, such as 2222.');
  if(market==='US'&&!/^[A-Z][A-Z0-9.-]{0,14}$/.test(normalized))throw Error('Enter a valid US stock symbol, such as AAPL.');
  return {symbol:normalized,market,currency};
}
function validateQuote(quote,request,now=Date.now()){
  if(!quote||quote.symbol!==request.symbol||quote.market!==request.market||quote.currency!==request.currency)throw Error('The returned quote does not match this stock and currency.');
  if(!Number.isFinite(quote.price)||quote.price<=0)throw Error('The provider returned an invalid price. Your entered price was kept.');
  const asOf=Date.parse(quote.asOf);
  if(!Number.isFinite(asOf)||asOf>now+5*60000)throw Error('The quote has an invalid update time.');
  if(typeof quote.source!=='string'||!quote.source.trim()||quote.source.length>100)throw Error('The quote is missing its source.');
  if(!['end-of-day','delayed','real-time'].includes(quote.feed))throw Error('The provider must identify whether this is a closing, delayed, or real-time quote.');
  return {...request,price:quote.price,asOf:new Date(asOf).toISOString(),source:quote.source,feed:quote.feed};
}
if(typeof module!=='undefined')module.exports={quoteRequest,validateQuote};
