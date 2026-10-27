/* Invoked by the single background router; MAX preparation is shared. */
globalThis.CopMonitorBackground={
 async run(message,sender,prepare){
  if((await chrome.storage.local.get('monitorEnabled')).monitorEnabled!==true)return {ok:false,code:'MONITOR_DISABLED'};
  if(message.type==='COP_MONITOR_OPEN_COP'){
   const open=await chrome.tabs.query({url:CopMaxPolicy.portal+'/*'});
   if(open.length===0){await chrome.tabs.create({url:CopMaxPolicy.portal+'/'});return {ok:true};}
   if(open.length!==1)return {ok:false,code:'MULTIPLE_COP'};
   await chrome.tabs.update(open[0].id,{active:true});await chrome.windows.update(open[0].windowId,{focused:true});return {ok:true};
  }
  const context=CopMonitorPolicy.context(message.context);
  if(message.type!=='COP_MONITOR_LOOKUP'&&message.type!=='COP_MONITOR_PREPARE')throw Error('INVALID_REQUEST');
  const selection=message.type==='COP_MONITOR_PREPARE'?CopMonitorPolicy.selection(message):{};
  const tabs=(await chrome.tabs.query({url:CopMaxPolicy.portal+'/*'})).filter(tab=>{try{return new URL(tab.url).origin===CopMaxPolicy.portal;}catch{return false;}});
  if(tabs.length!==1)return {ok:false,code:tabs.length?'MULTIPLE_COP':'COP_LOGIN_REQUIRED'};
  let response;
  try{response=await chrome.tabs.sendMessage(tabs[0].id,{type:'COP_MONITOR_QUERY',context,...selection},{frameId:0});}
  catch{return {ok:false,code:'COP_UNAVAILABLE'};}
  if(!response?.ok)return {ok:false,code:['COP_LOGIN_REQUIRED','BUSY'].includes(response?.code)?response.code:'COP_UNAVAILABLE'};
  const candidates=CopMonitorPolicy.candidates(response.candidates);
  if(message.type==='COP_MONITOR_LOOKUP')return {ok:true,code:['UNKNOWN_GROUP','TOO_MANY'].includes(response.code)?response.code:candidates.length?'OK':'NO_MATCH',candidates};
  if(candidates.length!==1||candidates[0].id!==selection.contactId||candidates[0].revision!==selection.revision)return {ok:false,code:'CONTACT_CHANGED'};
  const phone=CopMaxPolicy.phone(response.candidates[0].phone);
  if((await chrome.storage.local.get('monitorEnabled')).monitorEnabled!==true)return {ok:false,code:'MONITOR_DISABLED'};
  if(!/^[a-f0-9-]{36}$/.test(message.rowKey||''))return {ok:false,code:'ROW_CHANGED'};
  let current;
  try{current=await chrome.tabs.sendMessage(sender.tab.id,{type:'COP_MONITOR_VALIDATE',rowKey:message.rowKey,context},{frameId:0});}catch{return {ok:false,code:'ROW_CHANGED'};}
  if(current?.valid!==true)return {ok:false,code:'ROW_CHANGED'};
  return prepare({type:'COP_PREPARE_MAX',phone,createdAt:Date.now()});
 }
};
