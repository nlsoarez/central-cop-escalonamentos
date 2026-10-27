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
 function message(record,value){record.status.textContent=value;}
 function render(record,result){
  record.box.replaceChildren();record.status=document.createElement('span');record.status.setAttribute('role','status');
  const phone=button('☎',async()=>{
   if(!current(record)){scan();return;}
   if(!result?.ok){await lookup(record);return;}
   if(result.candidates.length===1){await select(record,result.candidates[0]);return;}
   record.choices.hidden=!record.choices.hidden;
  });
  phone.setAttribute('aria-label','Preparar escalonamento no MAX');phone.title='Preparar telefone no MAX; não inicia ligação';record.phone=phone;
  record.box.append(phone,record.status);
  if(!result){phone.disabled=true;message(record,'Consultando…');return;}
  if(!result.ok||!result.candidates?.length){
   message(record,errors[result.code]||'Não foi possível consultar. Tente novamente.');
   if(['MISSING_CONTEXT','INVALID_LEVEL','MONITOR_DISABLED'].includes(result.code))phone.disabled=true;
   const cop=button('Consultar no Central COP',async()=>{try{await chrome.runtime.sendMessage({type:'COP_MONITOR_OPEN_COP'});}catch{message(record,errors.COP_UNAVAILABLE);}});record.box.append(cop);return;
  }
  message(record,result.candidates.length===1?result.candidates[0].name:result.candidates.length+' responsáveis — escolha');
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
    const style=document.createElement('style');style.textContent=':host{display:block;margin-top:6px;text-align:left;font:12px system-ui;color:#242424}button{font:inherit;cursor:pointer;background:#fff;color:#b72019;border:1px solid #e8b7b3;border-radius:7px;padding:6px 9px;margin:3px}button:focus-visible{outline:3px solid #2267bb}button:disabled{opacity:.55;cursor:default}span[role=status]{display:inline-block;max-width:230px;vertical-align:middle}.choices{padding:6px;border:1px solid #ddd;border-radius:8px;background:#fff;max-height:260px;overflow:auto}.choices button{display:block;text-align:left;width:calc(100% - 6px);color:#202020}.choices small{display:block;color:#666;white-space:normal}';
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
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.monitorEnabled){enabled=changes.monitorEnabled.newValue===true;scan();}});
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,150);}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
