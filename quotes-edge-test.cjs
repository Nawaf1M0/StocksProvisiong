const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let handler,providerCalls=0;
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public'};
 const sandbox={Deno:{env:{get:k=>env[k]},serve:h=>handler=h},fetch:async url=>{if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'test-user'}));providerCalls++;return new Response(JSON.stringify({symbol:'2222',price:25,updated_at:'2026-10-15T12:00:00Z',is_delayed:true}));},Response,AbortSignal,Date,Map,Set,Number,String,JSON};
 vm.runInNewContext(fs.readFileSync('supabase/functions/market-quote/index.js','utf8'),sandbox);
 const request=(body,auth=true,origin='https://nawaf1m0.github.io')=>new Request('https://example.com',{method:'POST',headers:{Origin:origin,...auth?{Authorization:'Bearer test'}:{}},body:JSON.stringify(body)});
 assert.equal((await handler(request({market:'SA',symbol:'2222'},true,'https://other.com'))).status,403);
 assert.equal((await handler(request({market:'SA',symbol:'2222'},false))).status,401);
 assert.equal((await handler(request({market:'SA',symbol:'../invalid'}))).status,400);
 assert.equal((await handler(request({market:'SA',symbol:'2222'}))).status,503);assert.equal(providerCalls,0);
 // New instance to test a configured provider without the previous throttle.
 env.SAHMK_API_KEY='server-only';vm.runInNewContext(fs.readFileSync('supabase/functions/market-quote/index.js','utf8').replaceAll('const origins','var origins').replaceAll('const cache','var cache').replaceAll('const requests','var requests'),{...sandbox});
 const response=await handler(request({market:'SA',symbol:'2222'}));assert.equal(response.status,200);const quote=await response.json();assert.equal(quote.feed,'delayed');assert.equal(quote.currency,'SAR');assert.equal(quote.price,25);
 assert.ok(!JSON.stringify(quote).includes('server-only'));assert.equal(providerCalls,1);
 assert.equal((await handler(request({market:'SA',symbol:'2222'}))).status,200);assert.equal(providerCalls,1);
 console.log('Quote server checks passed: allowed origin, authentication, symbols, missing configuration, delayed normalization, secret exclusion, caching.');
})().catch(e=>{console.error(e);process.exitCode=1;});
