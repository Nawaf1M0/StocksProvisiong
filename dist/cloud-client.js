function createCloudClient(config, request=fetch){
  let session=null,refreshPromise=null,generation=0;
  const storageKey=config.storageKey;
  let storage;
  try{storage=config.storage||(storageKey?globalThis.localStorage:null);}catch{}
  function stored(){
    if(!storageKey||!storage)return null;
    try{const value=JSON.parse(storage.getItem(storageKey));return value&&typeof value.access_token==='string'&&typeof value.refresh_token==='string'&&Number.isFinite(value.expiresAt)?value:null;}catch{return null;}
  }
  function persistSession(){if(storageKey&&storage)try{storage.setItem(storageKey,JSON.stringify(session));}catch{storage=null;}}
  function clearSession(){generation++;session=null;if(storageKey&&storage)try{storage.removeItem(storageKey);}catch{}}
  function acceptSession(data){
    if(!data?.access_token||!data.user?.id||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Sign-in response is incomplete.');
    session={access_token:data.access_token,refresh_token:data.refresh_token||null,user:data.user,expiresAt:Date.now()+data.expires_in*1000};persistSession();return data.user;
  }
  async function ensureSession(){
    if(storageKey&&storage){const value=stored();if(value)session=value;}
    if(!session)throw Error('Session expired. Sign in again; your browser holdings are unchanged.');
    if(session.expiresAt>Date.now()+60000)return;
    if(!session.refresh_token){if(session.expiresAt>Date.now())return;clearSession();throw Error('Session expired. Sign in again.');}
    if(!refreshPromise){
      const currentGeneration=generation;
      const refresh=async()=>{
        const saved=stored();if(saved)session=saved;
        if(!session||generation!==currentGeneration)throw Error('Signed out. Please sign in again.');
        if(session.expiresAt>Date.now()+60000)return;
        try{
          const data=await api('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token});
          if(generation!==currentGeneration)throw Error('Signed out. Please sign in again.');
          acceptSession(data);
        }catch(error){if([400,401,403].includes(error.status)&&generation===currentGeneration)clearSession();throw error;}
      };
      const locks=globalThis.navigator?.locks;
      refreshPromise=(locks&&storageKey?locks.request(storageKey+'-refresh',refresh):refresh()).finally(()=>{refreshPromise=null;});
    }
    await refreshPromise;
  }
  async function api(path,body,authenticated=false,method,expectedUser){
    if(authenticated)await ensureSession();
    if(expectedUser&&session?.user?.id!==expectedUser)throw Error('The signed-in account changed. Retry after the account loads.');
    let response;
    try{response=await request(config.url+path,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:config.key,'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+session.access_token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});}
    catch(error){
      if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('Supabase connection timed out. Try another network.');
      if(error instanceof TypeError)throw Error('Unable to connect. Check your internet connection and try again. Your local portfolio is safe.');
      throw error;
    }
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      if(path.startsWith('/functions/v1/market-quote')&&response.status===404)throw Error('Market data is not connected yet. Continue entering your buy price manually.');
      if(data?.code==='40001')throw Error('Another device changed this portfolio. Export local changes and reload the cloud copy to resolve the conflict.');
      if(['42P01','PGRST202','PGRST205'].includes(data?.code))throw Error('Cloud storage is not ready yet. Your local portfolio is safe. Please contact the app owner.');
      const error=Error(data?.msg||data?.message||data?.error_description||'Cloud request failed. Please try again.');error.status=response.status;if(authenticated&&response.status===401)clearSession();throw error;
    }
    return data;
  }
  return {
    health:()=>api('/auth/v1/health'),
    quote:request=>api('/functions/v1/market-quote',request,true),
    async restore(){
      if(!storageKey||!storage)return session?.user||null;
      session=stored();if(!session)return null;
      const expected=generation;
      try{await ensureSession();const user=await api('/auth/v1/user',undefined,true);if(expected!==generation)throw Error('Session changed. Please sign in again.');if(!user?.id)throw Error('Unable to verify your session.');session.user=user;persistSession();return user;}catch(error){if([400,401,403].includes(error.status))clearSession();throw error;}
    },
    currentUser:()=>session?.user||null,
    async signInPassword(email,password){
      clearSession();
      const data=await api('/auth/v1/token?grant_type=password',{email,password});
      return acceptSession(data);
    },
    resetPassword:(email,redirectTo)=>{
      const redirect=new URL(redirectTo);if(redirect.protocol!=='https:')throw Error('Open the hosted app to reset your password.');
      return api('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect.href),{email});
    },
    async setPassword(password){
      if(password.length<8)throw Error('Choose a password of at least 8 characters.');
      return api('/auth/v1/user',{password},true,'PUT');
    },
    sendLink:(email,redirectTo)=>{
      const redirect=new URL(redirectTo);
      if(redirect.protocol!=='https:')throw Error('Open the hosted app to sign in.');
      return api('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect.href),{email,create_user:true});
    },
    async completeLink(params){
      clearSession();
      if(params.get('error')||params.get('error_description'))throw Error('This sign-in link is expired or invalid. Request a new link.');
      const token=params.get('access_token'),seconds=Number(params.get('expires_in'));
      if(!token||!Number.isFinite(seconds)||seconds<=0)throw Error('Sign-in link is incomplete. Request a new link.');
      const absoluteExpiry=Number(params.get('expires_at'));
      const expiresAt=params.has('expires_at')?Math.min(Date.now()+seconds*1000,absoluteExpiry*1000):Date.now()+seconds*1000;
      if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw Error('This sign-in link has expired. Request a new link.');
      session={access_token:token,refresh_token:params.get('refresh_token'),expiresAt};
      try{
        const user=await api('/auth/v1/user',undefined,true);
        if(!user?.id||!user.email)throw Error('Could not verify the signed-in account.');
        session.user=user;persistSession();return user;
      }catch(error){clearSession();throw error;}
    },
    async read(environment,expectedUser=session?.user?.id){
      await ensureSession();
      const data=await api('/rest/v1/portfolios?select=data,revision,updated_at&user_id=eq.'+encodeURIComponent(expectedUser||session?.user.id||'')+'&environment=eq.'+environment,undefined,true,undefined,expectedUser);
      if(!Array.isArray(data)||data.length>1)throw Error('Unexpected cloud portfolio response.');
      return data[0]||null;
    },
    async save(environment,data,revision,expectedUser=session?.user?.id){
      if(!Number.isSafeInteger(revision)||revision<0)throw Error('Load the cloud portfolio before uploading.');
      const result=await api('/rest/v1/rpc/save_portfolio',{p_environment:environment,p_data:data,p_expected_revision:revision},true,undefined,expectedUser);
      if(!Array.isArray(result)||!Number.isSafeInteger(result[0]?.revision))throw Error('Cloud did not confirm the save. Reload before retrying.');
      return result[0];
    },
    async signOut(){try{if(session)await api('/auth/v1/logout',{},true);}finally{clearSession();}},
    clear:clearSession
  };
}
if(typeof module!=='undefined')module.exports={createCloudClient};
