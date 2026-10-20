const assert=require('node:assert/strict');
const {createCloudClient}=require('./dist/cloud-client.js');
const user={id:'owner',email:'owner@example.com'};
const tokens=(suffix='1')=>({access_token:'access-'+suffix,refresh_token:'refresh-'+suffix,expires_in:3600,user});
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
(async()=>{
 const storage=memory();let refreshes=0,failOffline=false,rejectRefresh=false;
 const request=async(url,options)=>{
  if(failOffline)throw new TypeError('Failed to fetch');
  if(url.includes('grant_type=password'))return response(tokens());
  if(url.includes('grant_type=refresh_token')){refreshes++;assert.equal(JSON.parse(options.body).refresh_token,'refresh-1');return rejectRefresh?response({message:'Invalid refresh token'},400):response(tokens('2'));}
  if(url.endsWith('/auth/v1/user'))return response(user);
  if(url.includes('/rest/v1/portfolios'))return response([]);
  if(url.endsWith('/logout'))return response(null);
  throw Error('Unexpected URL');
 };
 const config={url:'https://test.supabase.co',key:'public',storageKey:'live-session',storage};
 let client=createCloudClient(config,request);await client.signInPassword(user.email,'never-store-this-password');
 assert.ok(storage.getItem('live-session'));assert.ok(!storage.getItem('live-session').includes('never-store-this-password'));
 client=createCloudClient(config,request);assert.equal((await client.restore()).id,user.id);
 assert.equal(await createCloudClient({...config,storageKey:'preview-session'},request).restore(),null);
 let saved=JSON.parse(storage.getItem('live-session'));saved.expiresAt=0;storage.setItem('live-session',JSON.stringify(saved));
 client=createCloudClient(config,request);await client.restore();assert.equal(refreshes,1);assert.equal(JSON.parse(storage.getItem('live-session')).refresh_token,'refresh-2');
 saved={...saved,expiresAt:0};storage.setItem('live-session',JSON.stringify(saved));
 client=createCloudClient(config,request);await Promise.all([client.read('live'),client.read('live')]);assert.equal(refreshes,2);
 failOffline=true;await assert.rejects(createCloudClient(config,request).restore(),/Unable to connect/);assert.ok(storage.getItem('live-session'));failOffline=false;
 storage.setItem('live-session',JSON.stringify(saved));rejectRefresh=true;await assert.rejects(createCloudClient(config,request).restore(),/Invalid refresh/);assert.equal(storage.getItem('live-session'),null);rejectRefresh=false;
 client=createCloudClient(config,request);await client.signInPassword(user.email,'password');await client.signOut();assert.equal(storage.getItem('live-session'),null);assert.equal(await createCloudClient(config,request).restore(),null);
 // A completed refresh must not resurrect a user who signed out during it.
 storage.setItem('live-session',JSON.stringify(saved));let release,started;
 const began=new Promise(r=>started=r);
 const delayed=createCloudClient(config,async(url,options)=>{if(url.includes('grant_type=refresh_token')){started();return new Promise(r=>release=()=>r(response(tokens('late'))));}return request(url,options);});
 const pending=delayed.restore();await began;delayed.clear();release();await assert.rejects(pending,/Signed out/);assert.equal(storage.getItem('live-session'),null);
 storage.setItem('live-session','broken-json');assert.equal(await createCloudClient(config,request).restore(),null);
 console.log('Persistent session checks passed: reload, rotation, concurrency, environment isolation, offline recovery, invalidation, sign-out, and refresh/sign-out race.');
})().catch(error=>{console.error(error);process.exitCode=1;});
