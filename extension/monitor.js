(() => {
 const policy=CopMonitorPolicy;
 if(location.origin!==policy.origin||location.pathname!==policy.path||window.top!==window)return;
 const errors={MISSING_CONTEXT:'Cidade/UF, grupo ou tecnologia ausente.',INVALID_LEVEL:'Nível de escalonamento inválido.',UNKNOWN_GROUP:'Grupo ou UF sem correspondência cadastrada.',NO_MATCH:'Nenhum responsável confirmado.',TOO_MANY:'Muitos responsáveis. Confira no Central COP.',COP_LOGIN_REQUIRED:'Entre no Central COP.',COP_UNAVAILABLE:'Central COP desconectado ou desatualizado.',MULTIPLE_COP:'Mantenha uma única aba do Central COP.',CONTACT_CHANGED:'Contato alterado. Consulte novamente.',ROW_CHANGED:'A ocorrência mudou. Consulte novamente.',NO_MAX:'Abra e entre no MAX.',MULTIPLE_MAX:'Mantenha uma única sessão do MAX.',MAX_NOT_READY:'Recarregue a extensão no MAX.',BUSY:'Assistente ocupado. Tente novamente.',MONITOR_DISABLED:'Assistente desativado.'};
 const byRow=new WeakMap(),records=new Map();let enabled=false,queue=Promise.resolve(),timer;
 const text=node=>node?.textContent?.trim()||'';
 function columns(table){
  const headers=Array.from(table.tHead?.rows?.[table.tHead.rows.length-1]?.cells||[]).map(c=>policy.normal(text(c)));
  const find=names=>{const ids=headers.flatMap((v,i)=>names.includes(v)?[i]:[]);return ids.length===1?ids[0]:-1;};
  return {rule:find(['regra']),group:find(['grupo']),city:find(['cidade','cidade/uf','cidade / uf','municipio','municipio/uf']),uf:find(['uf','estado']),technology:find(['tecnologia'])};
 }
 function extract(row){
  const map=columns(row.closest('table'));
  return policy.row(Object.fromEntries(Object.entries(map).map(([key,index])=>[key,index<0?'':text(row.cells[index])])));
 }
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const current=record=>record.row.isConnected&&enabled&&(()=>{try{return same(extract(record.row),record.context);}catch{return false;}})();
 function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',event=>{if(event.isTrusted)action();});return b;}
 function message(record,value){record.status.textContent=value;if(record.phone)record.phone.title=value+' — Preparar no MAX; não inicia ligação';}
 function phoneIcon(){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:'18',height:'18',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d','M22 16.92v3a2 2 0 0 1-2.18 2A19.7 19.7 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.77.64 2.6a2 2 0 0 1-.45 2.12L8.09 9.64a16 16 0 0 0 6.27 6.27l1.2-1.2a2 2 0 0 1 2.12-.45c.83.3 1.7.52 2.6.64A2 2 0 0 1 22 16.92Z');
  svg.append(path);return svg;
 }
 function render(record,result){
  record.box.replaceChildren();record.status=document.createElement('span');record.status.className='status sr';record.status.setAttribute('role','status');
  const phone=button('',async()=>{
   if(!current(record)){scan();return;}
   if(!result?.ok){await lookup(record);return;}
   if(result.candidates.length===1){await select(record,result.candidates[0]);return;}
   record.choices.hidden=!record.choices.hidden;
   phone.setAttribute('aria-expanded',String(!record.choices.hidden));
   if(!record.choices.hidden){for(const other of records.values())if(other!==record&&other.choices){other.choices.hidden=true;other.phone?.setAttribute('aria-expanded','false');}record.choices.querySelector('button')?.focus();}
  });
  phone.className='phone';phone.append(phoneIcon());
  phone.setAttribute('aria-label','Preparar escalonamento no MAX');phone.title='Preparar telefone no MAX; não inicia ligação';record.phone=phone;
  record.box.append(phone,record.status);
  if(!result){phone.disabled=true;message(record,'Consultando…');return;}
  if(!result.ok||!result.candidates?.length){
   record.status.className='status error';
   message(record,errors[result.code]||'Não foi possível consultar. Tente novamente.');
   if(['MISSING_CONTEXT','INVALID_LEVEL','MONITOR_DISABLED'].includes(result.code))phone.disabled=true;
   const cop=button('Consultar no Central COP',async()=>{try{await chrome.runtime.sendMessage({type:'COP_MONITOR_OPEN_COP'});}catch{message(record,errors.COP_UNAVAILABLE);}});record.box.append(cop);return;
  }
  message(record,result.candidates.length===1?result.candidates[0].name:result.candidates.length+' responsáveis — escolha');
  if(result.candidates.length>1){phone.setAttribute('aria-expanded','false');const count=document.createElement('span');count.className='count';count.setAttribute('aria-hidden','true');count.textContent=String(result.candidates.length);phone.append(count);}
  record.choices=document.createElement('div');record.choices.className='choices';record.choices.hidden=true;record.choices.setAttribute('role','group');record.choices.setAttribute('aria-label','Responsáveis compatíveis');
  for(const candidate of result.candidates){
   const option=button(candidate.name,()=>select(record,candidate));
   const details=document.createElement('small');details.textContent=[candidate.role,'N'+candidate.level,candidate.technology,candidate.scope==='local'?'Local':'Regional',candidate.coverage].filter(Boolean).join(' · ');option.append(details);record.choices.append(option);
  }
  record.box.append(record.choices);
 }
 async function lookup(record){
  if(!current(record))return;
  render(record,null);
  try{
   const result=await chrome.runtime.sendMessage({type:'COP_MONITOR_LOOKUP',context:record.context});
   if(current(record))render(record,result?.ok?{...result,candidates:policy.candidates(result.candidates)}:result||{ok:false});
  }catch{if(current(record))render(record,{ok:false,code:'COP_UNAVAILABLE'});}
 }
 async function select(record,candidate){
  if(record.pending||!current(record)){scan();return;}
  record.pending=true;record.phone.disabled=true;message(record,'Conferindo responsável…');
  try{
   const result=await chrome.runtime.sendMessage({type:'COP_MONITOR_PREPARE',context:record.context,contactId:candidate.id,revision:candidate.revision,rowKey:record.key});
   if(!current(record))return;
   if(result?.ok){message(record,'Preparado no MAX. Confira antes de chamar.');if(record.choices)record.choices.hidden=true;}
   else{render(record,{ok:false,code:result?.code||'COP_UNAVAILABLE'});}
  }catch{if(current(record))render(record,{ok:false,code:'COP_UNAVAILABLE'});}
  finally{record.pending=false;if(record.phone)record.phone.disabled=false;}
 }
 function scan(){
  for(const [key,record]of records)if(!enabled||!record.row.isConnected){record.host.remove();records.delete(key);byRow.delete(record.row);}
  if(!enabled)return;
  for(const table of document.querySelectorAll('table')){
   const map=columns(table);if(map.rule<0)continue;
   for(const body of table.tBodies)for(const row of body.rows){
    let context,error;try{context=extract(row);}catch(e){error=e.message;}
    const previous=byRow.get(row);
    if(!context&&!error){if(previous){previous.host.remove();records.delete(previous.key);byRow.delete(row);}continue;}
    if(previous&&same(previous.context,context)&&previous.error===error)continue;
    if(previous){previous.host.remove();records.delete(previous.key);}
    const host=document.createElement('span');host.className='cop-monitor-assistant';const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');style.textContent=':host{display:inline-block;position:relative;margin-inline-start:8px;vertical-align:middle;text-align:left;font:12px system-ui;color:#242424}button{font:inherit;cursor:pointer;background:#fff;color:#c8241c;border:1px solid #edc2bf;border-radius:8px;padding:7px 10px}button:focus-visible{outline:3px solid #2267bb;outline-offset:2px}button:disabled{opacity:.45;cursor:default}.phone{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:7px;vertical-align:middle;box-shadow:0 1px 3px #8c1b1710}.phone:hover:not(:disabled){background:#c8241c;color:#fff;border-color:#c8241c}.phone svg{display:block;flex-shrink:0}.count{position:absolute;right:-5px;top:-5px;background:#c8241c;color:#fff;border:2px solid #fff;border-radius:12px;min-width:14px;height:14px;padding:0 2px;font-size:10px;line-height:14px;text-align:center}.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.status.error{display:inline-block;max-width:200px;vertical-align:middle;margin:0 6px;color:#8b2420}.choices{position:absolute;z-index:1000;top:calc(100% + 8px);right:0;width:320px;max-width:72vw;padding:8px;border:1px solid #e8d8d6;border-radius:12px;background:#fff;box-shadow:0 10px 32px #29202024;max-height:260px;overflow:auto}.choices[hidden]{display:none}.choices button{display:block;text-align:left;width:100%;color:#202020;margin:0 0 6px}.choices button:last-child{margin-bottom:0}.choices button:hover{background:#fff4f3}.choices small{display:block;color:#666;white-space:normal;margin-top:4px;line-height:1.45}';
    const box=document.createElement('div');shadow.append(style,box);row.cells[map.rule].append(host);
    const record={row,context,error,host,box,key:crypto.randomUUID()};records.set(record.key,record);byRow.set(row,record);
    if(error)render(record,{ok:false,code:error});else{render(record,null);queue=queue.then(()=>lookup(record)).catch(()=>{});}
   }
  }
 }
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='COP_MONITOR_VALIDATE')return;
  if(sender.id!==chrome.runtime.id||sender.tab){respond({valid:false});return;}
  const record=records.get(message.rowKey);respond({valid:!!record&&current(record)&&same(record.context,message.context)});
 });
 chrome.storage.local.get('monitorEnabled').then(settings=>{enabled=settings.monitorEnabled===true;scan();});
 document.addEventListener('click',event=>{for(const record of records.values())if(record.choices&&!event.composedPath().includes(record.host)){record.choices.hidden=true;record.phone?.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;for(const record of records.values())if(record.choices&&!record.choices.hidden){record.choices.hidden=true;record.phone?.setAttribute('aria-expanded','false');if(document.activeElement===record.host)record.phone?.focus();}});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.monitorEnabled){enabled=changes.monitorEnabled.newValue===true;scan();}});
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,150);}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
