const cloudConfig={url:'https://szuzcqzxjolqshdvwvss.supabase.co',key:'sb_publishable_W7apGnbtu0m3Kr3vHS9kmw_dq1FZZbs'};
const cloud=createCloudClient(cloudConfig);
const cloudEnvironment=document.querySelector('meta[name="position-preview"]')?'preview':'live';
let cloudUser=null,cloudRevision=null,cloudBusy=false,syncedSnapshot=null;
const portfolioSnapshot=()=>JSON.stringify({stocks,currency});
function cloudMessage(message){$('cloud-status').textContent=message;}
function cloudControls(){
  $('cloud-auth').hidden=!!cloudUser;$('cloud-actions').hidden=!cloudUser;
  for(const button of $('cloud-panel').querySelectorAll('button'))button.disabled=cloudBusy;
  $('cloud-account').textContent=cloudUser?'Signed in as '+cloudUser.email+' · '+cloudEnvironment+' portfolio':'Optional · continue using this browser without signing in.';
}
async function cloudTask(task){if(cloudBusy)return;cloudBusy=true;cloudControls();try{await task();}catch(err){cloudMessage(err.name==='TimeoutError'?'Connection timed out. Your local holdings are unchanged.':err.message);}finally{cloudBusy=false;cloudControls();}}
function validateCloud(row){
  const data=row?.data;
  if(!Number.isSafeInteger(row?.revision)||row.revision<1||!data||!Array.isArray(data.stocks)||data.stocks.length>1000||!data.stocks.every(s=>valid(s)&&(s.fractional===undefined||typeof s.fractional==='boolean'))||!['USD','SAR','EUR','GBP','AED'].includes(data.currency))throw Error('Cloud portfolio is invalid. Local holdings were kept.');
  return data;
}
$('cloud-send').onclick=()=>cloudTask(async()=>{
  if(!$('cloud-email').reportValidity())return;
  const redirect=new URL(location.href);redirect.hash='';redirect.search='';
  await cloud.sendLink($('cloud-email').value.trim(),redirect.href);
  cloudMessage('Check your email and click the sign-in link. It will return you to this app. If no email arrives, check spam or your Supabase email delivery settings.');
});
$('cloud-check').onclick=()=>cloudTask(async()=>{
  const row=await cloud.read(cloudEnvironment);
  if(!row){cloudRevision=0;cloudMessage('No cloud portfolio yet. Upload to create one.');}
  else{validateCloud(row);cloudMessage('Cloud portfolio exists (revision '+row.revision+'). '+(cloudRevision===null?'Load it before uploading. Export local holdings first if you want to keep them.':'Load it to get the latest version.'));}
});
$('cloud-load').onclick=()=>cloudTask(async()=>{
  const before=portfolioSnapshot(),row=await cloud.read(cloudEnvironment);
  if(!row){cloudRevision=0;cloudMessage('No cloud portfolio yet. Your browser holdings were kept. Upload to create one.');return;}
  const data=validateCloud(row);
  if(portfolioSnapshot()!==before)throw Error('Local holdings changed while loading. Please try again.');
  if(!confirm('Replace this browser portfolio with '+data.stocks.length+' cloud holdings in '+data.currency+'? Export a local backup first if needed.'))return;
  stocks=data.stocks.map(s=>({...s}));currency=data.currency;$('currency').value=currency;persist();edit(stocks.length?0:null);
  cloudRevision=row.revision;syncedSnapshot=portfolioSnapshot();cloudMessage(storageFailed?'Loaded into this session, but browser storage failed. Export a backup.':'Cloud portfolio loaded. Local and cloud holdings match.');
});
$('cloud-upload').onclick=()=>cloudTask(async()=>{
  if(cloudRevision===null)throw Error('Check cloud status first. If a portfolio exists, load it before uploading. Export your local portfolio first if needed.');
  const snapshot=portfolioSnapshot(),data=JSON.parse(snapshot);
  if(data.stocks.length>1000||!data.stocks.every(valid))throw Error('Your portfolio has invalid holdings or exceeds 1000 entries.');
  if(!confirm('Upload '+data.stocks.length+' saved holdings to your '+cloudEnvironment+' cloud portfolio? Unsaved form edits are not included.'))return;
  const saved=await cloud.save(cloudEnvironment,data,cloudRevision);cloudRevision=saved.revision;syncedSnapshot=snapshot;
  cloudMessage('Cloud save confirmed at '+new Date().toLocaleTimeString()+'.'+(portfolioSnapshot()!==snapshot?' Local changes made during upload still need syncing.':''));
});
$('cloud-signout').onclick=()=>cloudTask(async()=>{
  let failed=false;try{await cloud.signOut();}catch{failed=true;}
  cloud.clear();cloudUser=null;cloudRevision=null;syncedSnapshot=null;
  cloudMessage(failed?'Signed out on this page. Server sign-out could not be confirmed. Browser holdings remain on this device.':'Signed out. Browser holdings remain on this device.');
});
function cloudChanged(){if(cloudUser&&syncedSnapshot!==portfolioSnapshot())cloudMessage('Saved browser holdings differ from the last synced copy. Upload when ready. Unsaved form edits must be saved first.');}
$('form').addEventListener('submit',cloudChanged);$('currency').addEventListener('change',cloudChanged);
new MutationObserver(cloudChanged).observe($('list'),{childList:true});
cloudControls();

const authParams=new URLSearchParams(location.hash.slice(1));
if(authParams.has('access_token')||authParams.has('error')||authParams.has('error_description')){
  // Remove credentials from the address bar before making any network request.
  history.replaceState(null,'',location.pathname+location.search);
  cloudTask(async()=>{
    cloudUser=await cloud.completeLink(authParams);cloudRevision=null;syncedSnapshot=null;
    cloudMessage('Signed in. Check cloud status or load your cloud portfolio. Nothing has been uploaded or replaced.');
  });
}

$('cloud-endpoint').textContent=cloudConfig.url;
$('cloud-endpoint').href=cloudConfig.url+'/auth/v1/health';
$('cloud-diagnose').onclick=()=>cloudTask(async()=>{
  await cloud.health();
  cloudMessage('Supabase connection succeeded. Try requesting the sign-in link again.');
});
