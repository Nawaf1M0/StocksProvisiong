const cloudConfig={url:'https://szuzcqzxjolqshdvwvss.supabase.co',key:'sb_publishable_W7apGnbtu0m3Kr3vHS9kmw_dq1FZZbs'};
const cloudEnvironment=document.querySelector('meta[name="position-preview"]')?'preview':'live';
const cloudSessionKey='position-auth-'+cloudEnvironment+'-v1';
const cloud=createCloudClient({...cloudConfig,storageKey:cloudSessionKey});
let cloudUser=null,cloudRevision=null,cloudBusy=false,syncedSnapshot=null;
const portfolioSnapshot=()=>JSON.stringify({stocks,currency});
function cloudMessage(message){$('cloud-status').textContent=message;}
function cloudControls(){
  $('cloud-auth').hidden=!!cloudUser;$('cloud-actions').hidden=!cloudUser;
  for(const button of $('cloud-panel').querySelectorAll('button'))button.disabled=cloudBusy;
  $('cloud-account').textContent=cloudUser?'Signed in as '+cloudUser.email+(cloudEnvironment==='preview'?' · Preview':''):'Use your portfolio on this device, or sign in to access cloud saves.';
}
async function cloudTask(task){if(cloudBusy)return;cloudBusy=true;$('cloud-panel').setAttribute('aria-busy','true');cloudControls();try{await task();}catch(err){if(!cloud.currentUser()){cloudUser=null;cloudRevision=null;syncedSnapshot=null;if(accountStore.owner())await accountStore.switchUser(null);}cloudMessage(err.name==='TimeoutError'?'Connection timed out. Your local holdings are unchanged.':err.message);}finally{cloudBusy=false;$('cloud-panel').setAttribute('aria-busy','false');cloudControls();}}
function cloudRedirect(){const url=new URL(location.href);url.hash='';url.search='';return url.href;}
$('cloud-signin-form').addEventListener('submit',e=>{
  e.preventDefault();cloudTask(async()=>{
    if(!$('cloud-signin-form').reportValidity())return;
    const password=$('cloud-password').value;$('cloud-password').value='';
    cloudUser=await cloud.signInPassword($('cloud-email').value.trim(),password);cloudRevision=null;syncedSnapshot=null;
    cloudMessage('Signed in. Checking your cloud portfolio…');await checkCloudPortfolio();
  });
});
$('cloud-forgot').onclick=()=>cloudTask(async()=>{
  if(!$('cloud-email').reportValidity())return;
  await cloud.resetPassword($('cloud-email').value.trim(),cloudRedirect());
  cloudMessage('If this email has an account, a password reset link will arrive shortly. Follow it to choose a new password.');
});
$('cloud-password-form').addEventListener('submit',e=>{
  e.preventDefault();cloudTask(async()=>{
    if(!$('cloud-password-form').reportValidity())return;
    const password=$('cloud-new-password').value;
    if(password!==$('cloud-confirm-password').value)throw Error('The new passwords do not match.');
    try{await cloud.setPassword(password);}finally{$('cloud-new-password').value='';$('cloud-confirm-password').value='';}
    $('cloud-password-settings').open=false;cloudMessage('Password saved. You can now sign in with your email and password.');
  });
});
$('cloud-send').onclick=()=>cloudTask(async()=>{
  if(!$('cloud-email').reportValidity())return;
  const redirect=new URL(location.href);redirect.hash='';redirect.search='';
  await cloud.sendLink($('cloud-email').value.trim(),redirect.href);
  cloudMessage('Check your inbox and click the sign-in link to return here. If it hasn’t arrived, check your spam folder before trying again.');
});
let accountStorage;try{accountStorage=localStorage;}catch{}
const accountStore=createAccountStore({
  storage:accountStorage,baseKey:guestPortfolioKey,
  validate:value=>value&&Array.isArray(value.stocks)&&value.stocks.length<=1000&&value.stocks.every(s=>valid(s)&&(s.fractional===undefined||typeof s.fractional==='boolean'))&&['USD','SAR','EUR','GBP','AED'].includes(value.currency),
  readRemote:id=>cloud.read(cloudEnvironment,id),
  saveRemote:(id,data,revision)=>cloud.save(cloudEnvironment,data,revision,id),
  onStatus:cloudMessage,
  onChange:(value,storageKey,owner)=>{
    const changed=key!==storageKey||portfolioSnapshot()!==JSON.stringify(value);
    key=storageKey;stocks=value.stocks;currency=value.currency;$('currency').value=currency;
    if(changed)edit(stocks.length?0:null);backupStatus();
    $('storage').textContent=owner?'Holdings are linked to your account. Check the account sync message above.':'Guest holdings are saved only on this device.';
    const guest=accountStore.guest();$('cloud-import-guest').hidden=!owner||!guest?.stocks.length;
  }
});
portfolioPersistence=accountStore;
// Keep the original guest key intact; never assign its holdings to an account silently.
accountStore.switchUser(null);
async function checkCloudPortfolio(){
  if(accountStore.owner()!==cloudUser?.id)await accountStore.switchUser(cloudUser?.id||null);
  else await accountStore.retry();
}
$('cloud-load').onclick=()=>cloudTask(async()=>{
  if(!cloudUser)return;
  if(!confirm('Reload your account’s cloud portfolio? Local pending changes will be replaced. Export a backup first if needed.'))return;
  await accountStore.reload();
});
$('cloud-upload').onclick=()=>cloudTask(async()=>{await accountStore.retry();});
$('cloud-import-guest').onclick=()=>cloudTask(async()=>{
  const guest=accountStore.guest();if(!cloudUser||!guest?.stocks.length)return;
  if(stocks.length&&currency!==guest.currency)throw Error('Guest holdings use a different currency. Export them and convert amounts before importing.');
  if(stocks.length+guest.stocks.length>1000)throw Error('This import would exceed the 1000-holding limit.');
  if(!confirm('Add '+guest.stocks.length+' previous device holdings to '+cloudUser.email+'? Only import data that belongs to you. The original local copy will be kept.'))return;
  stocks.push(...guest.stocks);currency=guest.currency;$('currency').value=currency;persist();edit(stocks.length?0:null);
});
$('cloud-signout').onclick=()=>cloudTask(async()=>{
  const pending=accountStore.hasPending();
  let failed=false;try{await cloud.signOut();}catch{failed=true;}
  cloud.clear();$('cloud-password-form').reset();$('cloud-password').value='';$('cloud-password-settings').open=false;cloudUser=null;cloudRevision=null;syncedSnapshot=null;await accountStore.switchUser(null);
  cloudMessage(pending?'Signed out. Pending account changes are kept on this device; sign in again to finish syncing.':failed?'Signed out on this page. Server sign-out could not be confirmed. Your account portfolio is kept.':'Signed out. Your account portfolio is kept.');
});
cloudControls();

const authParams=new URLSearchParams(location.hash.slice(1));
if(authParams.has('access_token')||authParams.has('error')||authParams.has('error_description')){
  // Remove credentials from the address bar before making any network request.
  history.replaceState(null,'',location.pathname+location.search);
  cloudTask(async()=>{
    cloudUser=await cloud.completeLink(authParams);cloudRevision=null;syncedSnapshot=null;
    if(authParams.get('type')==='recovery'){await checkCloudPortfolio();$('cloud-password-settings').open=true;cloudMessage('Choose a new password below to complete your reset.');$('cloud-new-password').focus();}else{cloudMessage('Signed in. Checking your cloud portfolio…');await checkCloudPortfolio();}
  });
}


async function restoreCloudSession(){
  if(cloudBusy)return;
  await cloudTask(async()=>{
    const user=await cloud.restore();
    if(!user){cloudUser=null;cloudRevision=null;syncedSnapshot=null;if(accountStore.owner())await accountStore.switchUser(null);return;}
    const changed=cloudUser?.id!==user.id;cloudUser=user;
    if(changed){cloudRevision=null;syncedSnapshot=null;cloudMessage('Welcome back. Loading your account portfolio…');await checkCloudPortfolio();}else if(accountStore.hasPending())await accountStore.retry();
  });
}
if(!authParams.has('access_token')&&!authParams.has('error')&&!authParams.has('error_description'))restoreCloudSession();
window.addEventListener('storage',event=>{
  if(event.key!==cloudSessionKey&&event.key!==null)return;
  if(event.newValue===null){cloud.clear();cloudUser=null;cloudRevision=null;syncedSnapshot=null;accountStore.switchUser(null);cloudControls();}
  else restoreCloudSession();
});
window.addEventListener('online',restoreCloudSession);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')restoreCloudSession();});
