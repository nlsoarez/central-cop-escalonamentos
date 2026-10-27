(() => {
 if(location.origin!==CopMaxPolicy.portal||window.top!==window)return;
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='COP_MONITOR_QUERY')return;
  if(sender.id!==chrome.runtime.id||sender.tab){respond({ok:false,code:'UNTRUSTED_SOURCE'});return;}
  try{
   const context=CopMonitorPolicy.context(message.context);
   const selection=message.contactId!==undefined?CopMonitorPolicy.selection(message):{};
   const channel=new MessageChannel();
   const timer=setTimeout(()=>{channel.port1.close();respond({ok:false,code:'COP_UNAVAILABLE'});},15000);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();respond(event.data);};
   window.postMessage({type:'COP_MONITOR_BRIDGE_V1',context,...selection},CopMaxPolicy.portal,[channel.port2]);
  }catch{respond({ok:false,code:'INVALID_REQUEST'});return;}
  return true;
 });
})();
