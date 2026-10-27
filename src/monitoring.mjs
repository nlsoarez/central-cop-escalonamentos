export const MONITOR_BRIDGE='COP_MONITOR_BRIDGE_V1';
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function monitoringContext(input){
 const context={group:String(input?.group||'').trim().replace(/\s+/g,' '),city:String(input?.city||'').trim().replace(/\s+/g,' '),uf:String(input?.uf||'').trim().toUpperCase(),technology:String(input?.technology||'').trim().toUpperCase(),level:input?.level};
 if(context.group.length<2||context.group.length>120||context.city.length<2||context.city.length>120||! /^[A-Z]{2}$/.test(context.uf)||!['HFC','GPON','FIBRA','COAXIAL','EMPRESARIAL','BKB'].includes(context.technology)||![1,2,3].includes(context.level))throw Error('Contexto inválido');
 return context;
}
export function installMonitoringBridge({store,window}){
 let busy=false;
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==window.location.origin||event.data?.type!==MONITOR_BRIDGE||event.ports?.length!==1)return;
  const port=event.ports[0];let acquired=false;
  try{
   if(busy){port.postMessage({ok:false,code:'BUSY'});return;}
   const context=monitoringContext(event.data.context);
   const id=event.data.contactId,revision=event.data.revision;
   if(id!==undefined&&(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{32}$/.test(revision||'')))throw Error('Invalid selection');
   busy=true;acquired=true;
   const user=await store.session();
   if(store.demo||!user?.active||user.must_change_password){port.postMessage({ok:false,code:'COP_LOGIN_REQUIRED'});return;}
   const result=await store.lookupMonitoring(context,id,revision);
   port.postMessage({ok:true,...result});
  }catch{port.postMessage({ok:false,code:'COP_UNAVAILABLE'});}
  finally{if(acquired)busy=false;port.close();}
 });
}
export function monitoringCoverageDialog(contact,rows=[],draft=null,busy=false){
 return '<div class="modal-backdrop" data-action="close-modal"><section class="modal-card report-dialog" role="dialog" aria-modal="true" aria-labelledby="coverage-title"><div class="modal-top"><h3 id="coverage-title">Abrangência do monitoramento</h3><button class="icon-btn" data-action="close-modal" aria-label="Fechar">×</button></div><p><strong>'+h(contact.full_name)+'</strong></p><p>Confirme as cidades atendidas por este registro. Uma linha por cidade: cidade;UF;tecnologia. Use ALL somente quando a abrangência valer para todas as tecnologias.</p><form id="monitorCoverageForm" data-id="'+h(contact.id)+'"><label class="field"><span>Cidades e tecnologias confirmadas</span><textarea name="coverage" rows="8" maxlength="320000" placeholder="Itabaiana;SE;HFC">'+h(draft??rows.map(r=>r.city+';'+r.uf+';'+r.technology).join('\n'))+'</textarea></label><p>Campos vazios removem os vínculos. Editar ou reimportar o contato exige confirmar esta abrangência novamente.</p><div class="modal-actions"><button class="btn primary" type="submit" '+(busy?'disabled':'')+'>Confirmar abrangência</button></div></form><details><summary>Configurar correspondência de grupo</summary><p>Cadastre o texto exato da coluna Grupo e as UFs que ele pode atender.</p><form id="monitorGroupForm"><label class="field">Nome do grupo<input name="alias" required maxlength="120" placeholder="Grupo Bahia/Sergipe"></label><label class="field">Grupo do Central COP<select name="cluster">'+['RJ','ES','MG','CO','NE','NO','BA'].map(c=>'<option>'+c+'</option>').join('')+'</select></label><label class="field">UFs separadas por vírgula<input name="ufs" required placeholder="BA, SE" maxlength="100"></label><button class="btn subtle" type="submit" '+(busy?'disabled':'')+'>Salvar correspondência</button></form></details></section></div>';
}
export function parseMonitoringCoverage(text){
 const rows=String(text).split(/\r?\n/).filter(x=>x.trim()).map(line=>{
  const fields=line.split(';').map(s=>s.trim());
  if(fields.length!==3||fields[0].length<2||fields[0].length>120||! /^[A-Z]{2}$/.test(fields[1].toUpperCase())||!['HFC','GPON','FIBRA','COAXIAL','EMPRESARIAL','BKB','ALL'].includes(fields[2].toUpperCase()))throw Error('Use cidade;UF;tecnologia em cada linha.');
  return {city:fields[0],uf:fields[1].toUpperCase(),technology:fields[2].toUpperCase()};
 });
 if(rows.length>2000)throw Error('Máximo de 2000 vínculos por contato.');return rows;
}
