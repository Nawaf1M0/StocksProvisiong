const origins = new Set(['https://nawaf1m0.github.io']);
const cache = new Map();
const requests = new Map();
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {status,headers});
  if (!origins.has(origin)) return reply({message:'Origin not allowed.'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply({message:'Use POST.'},405);
  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply({message:'Sign in before requesting market data.'},401);
    const auth = await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{Authorization:authorization,apikey:Deno.env.get('SUPABASE_ANON_KEY') || ''},signal:AbortSignal.timeout(10000)});
    if (!auth.ok) return reply({message:'Sign in again before requesting market data.'},401);
    const user = await auth.json();
    if (!user.id) return reply({message:'Sign in again.'},401);
    const input = await req.json();
    const symbol = String(input.symbol || '').trim().toUpperCase();
    const market = input.market;
    if (!(market==='SA'?/^\d{4}$/.test(symbol):market==='US'&&/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol))) return reply({message:'Invalid stock symbol or market.'},400);
    const key = market+':'+symbol;
    const cached = cache.get(key);
    // Cache reduces usage; it does not replace the provider account's quotas.
    if (cached && Date.now()-cached.time<15*60000) return reply(cached.quote);
    if (Date.now()-(requests.get(user.id)||0)<15000) return reply({message:'Please wait 15 seconds before refreshing another quote.'},429);
    requests.set(user.id,Date.now());
    if(requests.size>2000) for(const [id,time] of requests) if(Date.now()-time>60000)requests.delete(id);
    const token = Deno.env.get(market==='SA'?'SAHMK_API_KEY':'ALPHA_VANTAGE_API_KEY');
    if (!token) return reply({message:'Market data is not connected yet. Continue entering your buy price manually.'},503);
    const url = market==='SA'?'https://api.sahmk.sa/api/v1/quote/'+symbol+'/':'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='+encodeURIComponent(symbol)+'&apikey='+encodeURIComponent(token);
    const response = await fetch(url,{headers:market==='SA'?{'X-API-Key':token}:{},signal:AbortSignal.timeout(15000)});
    if (!response.ok) return reply({message:'The price provider is unavailable or its quota was reached. Your buy price was kept.'},502);
    const data = await response.json();
    let quote;
    if (market==='SA') {
      if(data.is_delayed!==true) return reply({message:'The provider did not confirm a delayed quote. Your buy price was kept.'},502);
      quote={symbol:String(data.symbol),market,currency:'SAR',price:Number(data.price),asOf:data.updated_at,source:'SAHMK',feed:'delayed',precision:'timestamp'};
    } else {
      const q=data['Global Quote'];
      if(!q) return reply({message:'No end-of-day quote is available, or the provider quota was reached.'},502);
      const date=q['07. latest trading day'];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply({message:'The provider returned an invalid trading date.'},502);
      quote={symbol:q['01. symbol'],market,currency:'USD',price:Number(q['05. price']),asOf:date+'T00:00:00Z',source:'Alpha Vantage',feed:'end-of-day',precision:'date'};
    }
    if(quote.symbol!==symbol||!Number.isFinite(quote.price)||quote.price<=0||!Number.isFinite(Date.parse(quote.asOf))||Date.parse(quote.asOf)>Date.now()+300000) return reply({message:'The provider returned an invalid quote. Your buy price was kept.'},502);
    if(cache.size>=500)cache.delete(cache.keys().next().value);
    cache.set(key,{time:Date.now(),quote});
    return reply(quote);
  } catch {
    return reply({message:'Unable to retrieve a quote. Your buy price was kept; please try again later.'},502);
  }
});
