function createCloudClient(config, request=fetch){
  let session=null;
  async function api(path,body,authenticated=false){
    if(authenticated&&(!session||Date.now()>=session.expiresAt))throw Error('Session expired. Sign in again; your browser holdings are unchanged.');
    const response=await request(config.url+path,{method:body===undefined?'GET':'POST',headers:{apikey:config.key,'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+session.access_token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      if(data?.code==='40001')throw Error('Another device changed this portfolio. Load the cloud version before uploading again. Export your local changes first.');
      if(['42P01','PGRST202','PGRST205'].includes(data?.code))throw Error('Cloud database setup is missing. Run the portfolio SQL migration in Supabase.');
      throw Error(data?.msg||data?.message||data?.error_description||'Cloud request failed. Please try again.');
    }
    return data;
  }
  return {
    sendCode:email=>api('/auth/v1/otp',{email,create_user:true}),
    async verify(email,token){
      const data=await api('/auth/v1/verify',{email,token,type:'email'});
      if(!data?.access_token||!data.user?.id||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Sign-in response is incomplete.');
      session={...data,expiresAt:Date.now()+data.expires_in*1000};return data.user;
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
