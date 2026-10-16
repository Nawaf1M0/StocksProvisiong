function createCloudClient(config, request=fetch){
  let session=null;
  async function api(path,body,authenticated=false){
    if(authenticated&&(!session||Date.now()>=session.expiresAt))throw Error('Session expired. Sign in again; your browser holdings are unchanged.');
    let response;
    try{response=await request(config.url+path,{method:body===undefined?'GET':'POST',headers:{apikey:config.key,'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+session.access_token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});}
    catch(error){
      if(error.name==='TimeoutError'||error.name==='AbortError')throw Error('Supabase connection timed out. Try another network.');
      if(error instanceof TypeError)throw Error('Cannot connect to '+config.url+'. Open the connection address below to check whether your browser can reach it. Check that the Supabase project is running; if needed, try another network or disable a blocking browser extension.');
      throw error;
    }
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      if(data?.code==='40001')throw Error('Another device changed this portfolio. Load the cloud version before uploading again. Export your local changes first.');
      if(['42P01','PGRST202','PGRST205'].includes(data?.code))throw Error('Cloud database setup is missing. Run the portfolio SQL migration in Supabase.');
      throw Error(data?.msg||data?.message||data?.error_description||'Cloud request failed. Please try again.');
    }
    return data;
  }
  return {
    health:()=>api('/auth/v1/health'),
    sendLink:(email,redirectTo)=>{
      const redirect=new URL(redirectTo);
      if(redirect.protocol!=='https:')throw Error('Open the hosted app to sign in.');
      return api('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect.href),{email,create_user:true});
    },
    async completeLink(params){
      session=null;
      if(params.get('error')||params.get('error_description'))throw Error('This sign-in link is expired or invalid. Request a new link.');
      const token=params.get('access_token'),seconds=Number(params.get('expires_in'));
      if(!token||!Number.isFinite(seconds)||seconds<=0)throw Error('Sign-in link is incomplete. Request a new link.');
      const absoluteExpiry=Number(params.get('expires_at'));
      const expiresAt=params.has('expires_at')?Math.min(Date.now()+seconds*1000,absoluteExpiry*1000):Date.now()+seconds*1000;
      if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())throw Error('This sign-in link has expired. Request a new link.');
      session={access_token:token,expiresAt};
      try{
        const user=await api('/auth/v1/user',undefined,true);
        if(!user?.id||!user.email)throw Error('Could not verify the signed-in account.');
        session.user=user;return user;
      }catch(error){session=null;throw error;}
    },
    async read(environment){
      const data=await api('/rest/v1/portfolios?select=data,revision,updated_at&user_id=eq.'+encodeURIComponent(session?.user.id||'')+'&environment=eq.'+environment,undefined,true);
      if(!Array.isArray(data)||data.length>1)throw Error('Unexpected cloud portfolio response.');
      return data[0]||null;
    },
    async save(environment,data,revision){
      if(!Number.isSafeInteger(revision)||revision<0)throw Error('Load the cloud portfolio before uploading.');
      const result=await api('/rest/v1/rpc/save_portfolio',{p_environment:environment,p_data:data,p_expected_revision:revision},true);
      if(!Array.isArray(result)||!Number.isSafeInteger(result[0]?.revision))throw Error('Cloud did not confirm the save. Reload before retrying.');
      return result[0];
    },
    async signOut(){try{if(session)await api('/auth/v1/logout',{},true);}finally{session=null;}},
    clear(){session=null;}
  };
}
if(typeof module!=='undefined')module.exports={createCloudClient};
