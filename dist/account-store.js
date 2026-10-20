// Stable account keys and database revisions are independent of app releases.
function createAccountStore(options){
  const {storage,baseKey,validate,readRemote,saveRemote,onChange,onStatus}=options;
  const normalize=options.normalize||(value=>value);
  let user=null,epoch=0,record=null,ready=false,running=null,serial=0;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const signature=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const empty=()=>({stocks:[],currency:'USD'});
  const keyFor=id=>id?baseKey+':user:'+id:baseKey;
  function load(key){try{const raw=JSON.parse(storage.getItem(key));const value=raw?normalize(raw):null;return value&&validate(value)?value:null;}catch{return null;}}
  function data(){return {stocks:record.stocks,currency:record.currency};}
  function write(){try{storage.setItem(keyFor(user),JSON.stringify(record));return true;}catch{onStatus('Browser storage failed. Export a backup; account changes still need a confirmed cloud save.');return false;}}
  function status(message){onStatus(message);}
  function show(){onChange(copy(data()),keyFor(user),user);}
  function remoteRow(row){
    if(!row)return null;
    const normalized=normalize(row.data);
    if(!validate(normalized)||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('The cloud portfolio is invalid. Your local copy was kept.');
    return {...row,data:normalized};
  }
  async function flush(){
    if(!user||!ready||!record._sync.dirty)return;
    if(running)return running;
    const id=user,stamp=epoch;
    const operation=(async()=>{
      while(stamp===epoch&&ready&&record._sync.dirty){
        const version=serial,snapshot=copy(data()),revision=record._sync.revision;
        status('Saving your portfolio to your account…');
        try{
          const saved=remoteRow(await saveRemote(id,snapshot,revision));
          if(stamp!==epoch)return;
          if(!saved)throw Error('Cloud save was not confirmed.');
          record._sync={revision:saved.revision,dirty:serial!==version};
          write();
          if(!record._sync.dirty)status('Saved to your account. Your portfolio will return when you sign in.');
        }catch(error){
          if(stamp!==epoch)return;
          ready=false;write();status(error.message+' Changes remain in your account’s local copy; retry syncing when connected.');return;
        }
      }
    })();
    running=operation;
    try{await operation;}finally{if(stamp===epoch)running=null;}
  }
  async function connect(discard=false){
    if(!user)return;
    if(running)await running;
    const id=user,stamp=epoch;
    ready=false;
    try{
      const row=remoteRow(await readRemote(id));
      if(stamp!==epoch)return;
      const sync=record._sync;
      if(discard){
        // Keep a recovery copy before an explicit cloud replacement.
        try{storage.setItem(keyFor(user)+':recovery',JSON.stringify(record));}catch{throw Error('Could not preserve a recovery copy. Export your local data before loading cloud data.');}
      }
      if(!discard&&sync.dirty){
        if(row&&signature(row.data)===signature(data())){record._sync={revision:row.revision,dirty:false};ready=true;write();status('Your account portfolio is up to date.');return;}
        if(!row&&sync.revision===null)sync.revision=0;
        if((row?row.revision:0)!==sync.revision){
          status('Another device changed your portfolio. Your local changes were kept. Export them, then reload the cloud copy to resolve the conflict.');return;
        }
        ready=true;await flush();return;
      }
      if(!row&&!discard&&sync.revision>0){status('The cloud copy is missing. Your cached portfolio was kept; export a backup before making changes.');return;}
      record={...(row?copy(row.data):empty()),_sync:{revision:row?row.revision:0,dirty:false}};
      ready=true;write();show();
      status(row?'Your account portfolio is loaded. Saved changes sync automatically.':'Your account portfolio is ready. Add holdings or import previous device holdings.');
    }catch(error){if(stamp===epoch){ready=false;status(error.message+' Your cached portfolio was kept.');}}
  }
  async function switchUser(id){
    epoch++;user=id;ready=false;running=null;serial=0;
    const cached=load(keyFor(id));
    record=cached?copy(cached):{...empty()};
    if(id){
      const sync=record._sync;
      record._sync={revision:Number.isSafeInteger(sync?.revision)&&sync.revision>=0?sync.revision:null,dirty:sync?.dirty===true};
    }else delete record._sync;
    show();
    if(id){status('Loading the portfolio for your account…');await connect();}
    else status('Signed out. Only local guest holdings are shown. Your account portfolio is kept separately.');
  }
  return {
    switchUser,
    owner:()=>user,
    key:()=>keyFor(user),
    hasPending:()=>!!user&&record?record._sync.dirty:false,
    async retry(){await connect();},
    async reload(){await connect(true);},
    guest:()=>{const value=load(baseKey);return value?copy({stocks:value.stocks,currency:value.currency}):null;},
    saveLocal(value){
      value=normalize(value);
      if(!validate(value))throw Error('Invalid portfolio. Your saved copy was kept.');
      serial++;
      record={...copy(value),...(user?{_sync:{revision:record?._sync?.revision??null,dirty:true}}:{})};
      const saved=write();
      if(user){status(saved?'Changes saved on this device; waiting for account sync.':'Browser storage failed. Keep this page open and export a backup while account sync is pending.');if(ready)void flush();}
      return saved;
    }
  };
}
if(typeof module!=='undefined')module.exports={createAccountStore};
