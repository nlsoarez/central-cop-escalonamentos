importScripts('policy.js','monitor-policy.js','monitor-background.js');
chrome.action?.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
let busy = false;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (CopMonitorPolicy.sender(sender,chrome.runtime.id)) {
    if(busy){respond({ok:false,code:'BUSY'});return;}
    busy=true;
    CopMonitorBackground.run(message,sender,prepareMax).then(respond).catch(()=>respond({ok:false,code:'INVALID_REQUEST'})).finally(()=>{busy=false;});
    return true;
  }
  if (!CopMaxPolicy.trustedSender(sender, chrome.runtime.id)) { respond({ok: false, code: 'UNTRUSTED_SOURCE'}); return; }
  let request;
  try { request = CopMaxPolicy.request(message); } catch { respond({ok: false, code: 'INVALID_REQUEST'}); return; }
  if (busy) { respond({ok: false, code: 'BUSY'}); return; }
  busy = true;
  prepareMax(request).then(respond).catch(() => respond({ok: false, code: 'UNAVAILABLE'})).finally(() => { busy = false; });
  return true;
});
async function prepareMax(request) {
    let found;
    try { found = await chrome.tabs.query({url: 'https://max.niceincontact.com/index.html*'}); }
    catch { return {ok: false, code: 'QUERY_FAILED'}; }
    const tabs = found.filter(tab => {
      try { const url = new URL(tab.url); return url.origin === CopMaxPolicy.max && url.pathname === '/index.html'; } catch { return false; }
    });
    if (tabs.length !== 1) return {ok: false, code: tabs.length ? 'MULTIPLE_MAX' : 'NO_MAX'};
    let result;
    try { result = await chrome.tabs.sendMessage(tabs[0].id, request, {frameId: 0}); }
    catch { return {ok: false, code: 'MAX_NOT_READY'}; }
    if (!result?.ok) return {ok: false, code: result?.code || 'UNAVAILABLE'};
    try {
      await chrome.tabs.update(tabs[0].id, {active: true});
      await chrome.windows.update(tabs[0].windowId, {focused: true});
    } catch { return {ok: true, code: 'PREPARED_NO_FOCUS'}; }
    return {ok: true, code: 'PREPARED'};
}
