let displayedQuote=null;
const currentQuoteRequest=()=>quoteRequest($('symbol').value,$('quote-market').value,currency);
function clearQuote(){displayedQuote=null;$('quote-use').hidden=true;$('quote-result').textContent='Fetch a reference price, then choose whether to use it. Your entered buy price stays unchanged.';}
$('quote-fetch').onclick=async()=>{
  if($('quote-fetch').disabled)return;
  $('quote-fetch').disabled=true;displayedQuote=null;$('quote-use').hidden=true;
  try{
    if(!cloudUser)throw Error('Sign in above to request a market price, or enter your buy price manually.');
    const request=currentQuoteRequest();$('quote-result').textContent='Retrieving reference price…';
    const response=await cloud.quote(request);
    const current=currentQuoteRequest();
    if(JSON.stringify(current)!==JSON.stringify(request))throw Error('The selected stock or currency changed. Please fetch its price again.');
    displayedQuote={...validateQuote(response,request),precision:response.precision};
    const date=response.precision==='date'?displayedQuote.asOf.slice(0,10):new Date(displayedQuote.asOf).toLocaleString();
    $('quote-result').textContent=money(displayedQuote.price)+' · '+displayedQuote.source+' · '+displayedQuote.feed+' · '+(response.precision==='date'?'Trading date: ':'Quote time: ')+date+'. This is a reference price, not a guaranteed execution price.';
    $('quote-use').hidden=false;
  }catch(error){$('quote-result').textContent=error.message;}
  finally{$('quote-fetch').disabled=false;}
};
$('quote-use').onclick=()=>{
  if(!displayedQuote)return;
  try{
    const request=currentQuoteRequest();validateQuote(displayedQuote,request);
    $('price').value=displayedQuote.price;$('form').dispatchEvent(new Event('input',{bubbles:true}));
    $('notice').textContent='Reference price copied into your plan. Review the calculation and save the holding to keep it.';
  }catch(error){clearQuote();$('quote-result').textContent=error.message;}
};
$('quote-market').onchange=clearQuote;$('symbol').addEventListener('input',clearQuote);$('currency').addEventListener('change',clearQuote);
new MutationObserver(clearQuote).observe($('list'),{childList:true});
