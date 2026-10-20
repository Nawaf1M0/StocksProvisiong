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
async function cloudTask(task){if(cloudBusy)return;cloudBusy=true;$('cloud-panel').setAttribute('aria-busy','true');cloudControls();try{await task();}catch(err){if(!cloud.currentUser()){cloudUser=null;cloudRevision=null;syncedSnapshot=null;}cloudMessage(err.name==='TimeoutError'?'Connection timed out. Your local holdings are unchanged.':err.message);}finally{cloudBusy=false;$('cloud-panel').setAttribute('aria-busy','false');cloudControls();}}
function validateCloud(row){
  const data=row?.data;
  if(!Number.isSafeInteger(row?.revision)||row.revision<1||!data||!Array.isArray(data.stocks)||data.stocks.length>1000||!data.stocks.every(s=>valid(s)&&(s.fractional===undefined||typeof s.fractional==='boolean'))||!['USD','SAR','EUR','GBP','AED'].includes(data.currency))throw Error('Cloud portfolio is invalid. Local holdings were kept.');
  return data;
}
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
async function checkCloudPortfolio(){
  const row=await cloud.read(cloudEnvironment);
  if(!row){cloudRevision=0;cloudMessage('You’re signed in. Save your portfolio to access it on another device.');}
  else{validateCloud(row);cloudMessage('Your cloud portfolio is ready. Load it to continue, or export this device’s holdings first if you want to keep a backup.');}
}
$('cloud-load').onclick=()=>cloudTask(async()=>{
  const before=portfolioSnapshot(),row=await cloud.read(cloudEnvironment);
  if(!row){cloudRevision=0;cloudMessage('No cloud portfolio yet. Your browser holdings were kept. Upload to create one.');return;}
  const data=validateCloud(row);
  if(portfolioSnapshot()!==before)throw Error('Local holdings changed while loading. Please try again.');
  if(!confirm('Replace this browser portfolio with '+data.stocks.length+' cloud holdings in '+data.currency+'? Export a local backup first if needed.'))return;
  stocks=data.stocks.map(s=>({...s}));currency=data.currency;$('currency').value=currency;persist();edit(stocks.length?0:null);
  cloudRevision=row.revision;syncedSnapshot=portfolioSnapshot();cloudMessage(storageFailed?'Loaded into this session, but browser storage failed. Export a backup.':'Your cloud portfolio is now loaded on this device.');
});
$('cloud-upload').onclick=()=>cloudTask(async()=>{
  if(cloudRevision===null){const row=await cloud.read(cloudEnvironment);if(row)throw Error('Load your cloud portfolio before saving changes. Export this device’s holdings first if you want to keep them.');cloudRevision=0;}
  const snapshot=portfolioSnapshot(),data=JSON.parse(snapshot);
  if(data.stocks.length>1000||!data.stocks.every(valid))throw Error('Your portfolio has invalid holdings or exceeds 1000 entries.');
  if(!confirm('Upload '+data.stocks.length+' saved holdings to your '+cloudEnvironment+' cloud portfolio? Unsaved form edits are not included.'))return;
  const saved=await cloud.save(cloudEnvironment,data,cloudRevision);cloudRevision=saved.revision;syncedSnapshot=snapshot;
  cloudMessage('Saved to cloud at '+new Date().toLocaleTimeString()+'.'+(portfolioSnapshot()!==snapshot?' Local changes made during upload still need syncing.':''));
});
$('cloud-signout').onclick=()=>cloudTask(async()=>{
  let failed=false;try{await cloud.signOut();}catch{failed=true;}
  cloud.clear();$('cloud-password-form').reset();$('cloud-password').value='';$('cloud-password-settings').open=false;cloudUser=null;cloudRevision=null;syncedSnapshot=null;
  cloudMessage(failed?'Signed out on this page. Server sign-out could not be confirmed. Browser holdings remain on this device.':'Signed out. Browser holdings remain on this device.');
});
function cloudChanged(){if(cloudUser&&syncedSnapshot!==portfolioSnapshot())cloudMessage('This device has changes that haven’t been saved to cloud. Save your holdings first, then choose Save to cloud.');}
$('form').addEventListener('submit',cloudChanged);$('currency').addEventListener('change',cloudChanged);
new MutationObserver(cloudChanged).observe($('list'),{childList:true});
cloudControls();

const authParams=new URLSearchParams(location.hash.slice(1));
if(authParams.has('access_token')||authParams.has('error')||authParams.has('error_description')){
  // Remove credentials from the address bar before making any network request.
  history.replaceState(null,'',location.pathname+location.search);
  cloudTask(async()=>{
    cloudUser=await cloud.completeLink(authParams);cloudRevision=null;syncedSnapshot=null;
    if(authParams.get('type')==='recovery'){$('cloud-password-settings').open=true;cloudMessage('Choose a new password below to complete your reset.');$('cloud-new-password').focus();}else{cloudMessage('Signed in. Checking your cloud portfolio…');await checkCloudPortfolio();}
  });
}


async function restoreCloudSession(){
  if(cloudBusy)return;
  await cloudTask(async()=>{
    const user=await cloud.restore();
    if(!user){cloudUser=null;cloudRevision=null;syncedSnapshot=null;return;}
    const changed=cloudUser?.id!==user.id;cloudUser=user;
    if(changed){cloudRevision=null;syncedSnapshot=null;cloudMessage('Welcome back. Checking your cloud portfolio…');await checkCloudPortfolio();}
  });
}
if(!authParams.has('access_token')&&!authParams.has('error')&&!authParams.has('error_description'))restoreCloudSession();
window.addEventListener('storage',event=>{
  if(event.key!==cloudSessionKey&&event.key!==null)return;
  if(event.newValue===null){cloud.clear();cloudUser=null;cloudRevision=null;syncedSnapshot=null;cloudControls();cloudMessage('Signed out. Your local portfolio is still on this device.');}
  else restoreCloudSession();
});
window.addEventListener('online',restoreCloudSession);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')restoreCloudSession();});
