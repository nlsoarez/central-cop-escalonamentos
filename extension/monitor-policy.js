/* Pure validation; no network, authentication or persistent contact data. */
globalThis.CopMonitorPolicy=Object.freeze({
 origin:'http://10.29.5.216',path:'/portal/pages/ui_monitoramento.php',
 normal(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();},
 sender(sender,id){try{const url=new URL(sender.url);return sender.id===id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&url.origin===this.origin&&url.pathname===this.path;}catch{return false;}},
 context(value){
  const c={group:String(value?.group||'').trim().replace(/\s+/g,' '),city:String(value?.city||'').trim().replace(/\s+/g,' '),uf:String(value?.uf||'').trim().toUpperCase(),technology:String(value?.technology||'').trim().toUpperCase(),level:value?.level};
  if(c.group.length<2||c.group.length>120||c.city.length<2||c.city.length>120||!/^[A-Z]{2}$/.test(c.uf)||!['HFC','GPON','FIBRA','COAXIAL','EMPRESARIAL','BKB'].includes(c.technology)||![1,2,3].includes(c.level))throw Error('MISSING_CONTEXT');
  return c;
 },
 row(cells){
  const rule=this.normal(cells.rule);if(!/\bescalonamento\b/.test(rule))return null;
  const levels=[...rule.matchAll(/\bn\s*([0-9]+)\b/g)].map(m=>Number(m[1]));
  if(levels.length!==1||![1,2,3].includes(levels[0]))throw Error('INVALID_LEVEL');
  const city=String(cells.city||'').trim().match(/^(.+?)\s*(?:\/|\s-\s|\()\s*([A-Za-z]{2})\)?$/);
  return this.context({group:cells.group,city:city?.[1],uf:cells.uf||city?.[2],technology:cells.technology,level:levels[0],...(cells.uf?{city:cells.city}:{} )});
 },
 selection(message){if(!/^[a-f0-9-]{36}$/.test(message.contactId||'')||!/^[a-f0-9]{32}$/.test(message.revision||''))throw Error('INVALID_SELECTION');return {contactId:message.contactId,revision:message.revision};},
 candidates(value){
  if(!Array.isArray(value)||value.length>100)throw Error('INVALID_RESPONSE');
  return value.map(c=>{if(!/^[a-f0-9-]{36}$/.test(c.id||'')||!/^[a-f0-9]{32}$/.test(c.revision||'')||typeof c.name!=='string'||c.name.length>160)throw Error('INVALID_RESPONSE');return {id:c.id,revision:c.revision,name:c.name,role:String(c.role||'').slice(0,160),level:c.level,technology:String(c.technology||'').slice(0,30),scope:c.scope==='local'?'local':'regional',coverage:String(c.coverage||'').slice(0,300)};});
 }
});
