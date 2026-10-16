const assert=require('node:assert/strict');
const {createCloudClient}=require('./dist/cloud-client.js');
(async()=>{
 const calls=[];let responses=[];
 const request=async(url,options)=>{calls.push({url,options});const next=responses.shift();if(!next)throw Error('Unexpected request');return {ok:next.ok!==false,json:async()=>next.data};};
 const client=createCloudClient({url:'https://test.supabase.co',key:'public'},request);
 await assert.rejects(client.read('preview'),/expired/);assert.equal(calls.length,0);
 responses.push({data:{}},{data:{access_token:'test-token',expires_in:3600,user:{id:'user-1',email:'test@example.com'}}});
 await client.sendCode('test@example.com');await client.verify('test@example.com','123456');
 responses.push({data:[]});assert.equal(await client.read('preview'),null);assert.ok(calls.at(-1).url.includes('environment=eq.preview'));
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-token');
 await assert.rejects(client.save('preview',{},null),/Load/);
 responses.push({ok:false,data:{code:'40001'}});await assert.rejects(client.save('preview',{stocks:[]},2),/Another device/);
 responses.push({data:[{revision:3}]});assert.equal((await client.save('live',{stocks:[],currency:'USD'},2)).revision,3);
 assert.deepEqual(JSON.parse(calls.at(-1).options.body),{p_environment:'live',p_data:{stocks:[],currency:'USD'},p_expected_revision:2});
 responses.push({ok:false,data:{code:'42P01'}});await assert.rejects(client.read('preview'),/setup is missing/);
 responses.push({ok:false,data:{message:'offline'}});await assert.rejects(client.signOut(),/offline/);await assert.rejects(client.read('preview'),/expired/);
 console.log('Cloud client checks passed: sign-in, auth headers, environment separation, revisions, conflicts, missing schema, sign-out cleanup.');
})().catch(err=>{console.error(err);process.exitCode=1;});
