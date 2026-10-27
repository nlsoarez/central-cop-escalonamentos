import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {installMonitoringBridge,parseMonitoringCoverage,monitoringCoverageDialog} from '../src/monitoring.mjs';
const source=await readFile(new URL('../extension/monitor-policy.js',import.meta.url),'utf8');
const sandbox={URL};vm.runInNewContext(source,sandbox);const p=sandbox.CopMonitorPolicy;
const context={group:'Grupo Bahia/Sergipe',city:'Itabaiana',uf:'SE',technology:'HFC',level:2};
test('linha exige Escalonamento, nível exato e contexto completo; SS não é filtro',()=>{
 const row={rule:'ESCALONAMENTO - SS N2',group:context.group,city:'Itabaiana/SE',technology:'HFC'};
 assert.deepEqual(JSON.parse(JSON.stringify(p.row(row))),context);
 assert.equal(p.row({...row,rule:'TOA — OTG SEM TASK'}),null);
 for(const rule of ['ESCALONAMENTO N10','ESCALONAMENTO N4','ESCALONAMENTO N1 N3','ESCALONAMENTO'])assert.throws(()=>p.row({...row,rule}));
 for(const city of ['', 'Itabaiana'])assert.throws(()=>p.row({...row,city}));
 assert.equal(p.row({...row,city:'Itabaiana',uf:'SE'}).city,'Itabaiana');
 assert.throws(()=>p.row({...row,technology:''}));
});
test('origem do monitoramento exige host, protocolo, caminho, extensão e frame exatos',()=>{
 const sender={id:'ext',frameId:0,tab:{id:2},url:'http://10.29.5.216/portal/pages/ui_monitoramento.php?filter=1'};
 assert.equal(p.sender(sender,'ext'),true);
 for(const patch of [{id:'other'},{frameId:1},{url:'http://10.29.5.216/other.php'},{url:'https://evil.invalid/portal/pages/ui_monitoramento.php'},{tab:null}])assert.equal(p.sender({...sender,...patch},'ext'),false);
});
test('editor administrativo preserva ocorrências, valida entradas e escapa HTML',()=>{
 assert.equal(parseMonitoringCoverage('Itabaiana;SE;HFC\nItabaiana;PB;GPON').length,2);
 assert.deepEqual(parseMonitoringCoverage(''),[]);
 assert.throws(()=>parseMonitoringCoverage('Itabaiana;SE;'));
 const html=monitoringCoverageDialog({id:'test',full_name:'<img src=x onerror=alert(1)>'},[], '<script>');
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;script&gt;/);
});
test('ponte usa sessão do portal e retorna somente a resposta da consulta; login pendente é rejeitado',async()=>{
 let handler;const replies=[],calls=[];
 const window={location:{origin:'https://central-cop-escalonamentos.vercel.app'},addEventListener:(_,fn)=>{handler=fn;}};
 let user={active:true,must_change_password:false};
 const store={session:async()=>user,lookupMonitoring:async(...args)=>{calls.push(args);return {code:'NO_MATCH',candidates:[]};}};
 installMonitoringBridge({store,window});
 const event={source:window,origin:window.location.origin,data:{type:'COP_MONITOR_BRIDGE_V1',context,incidentDetails:'never forwarded'},ports:[{postMessage:value=>replies.push(value),close(){}}]};
 await handler(event);assert.equal(replies[0].ok,true);assert.deepEqual(calls[0],[context,undefined,undefined]);
 user={active:true,must_change_password:true};await handler(event);assert.equal(replies.at(-1).code,'COP_LOGIN_REQUIRED');
 const before=replies.length;await handler({...event,origin:'http://10.29.5.216'});assert.equal(replies.length,before);
});
test('monitoramento revalida contato e linha antes de usar a preparação MAX existente',async()=>{
 const background=await readFile(new URL('../extension/monitor-background.js',import.meta.url),'utf8');
 const id='10000000-0000-4000-8000-000000000001',revision='a'.repeat(32);
 const candidate={id,revision,name:'Pessoa fictícia',role:'Coordenação',scope:'local',technology:'HFC',level:2,coverage:'Itabaiana/SE',phone:'+5511999990001'};
 const calls=[];let enabled=true,valid=true;
 const scope={URL,Date,CopMonitorPolicy:p,CopMaxPolicy:{portal:'https://central-cop-escalonamentos.vercel.app',phone:x=>x},chrome:{storage:{local:{get:async()=>({monitorEnabled:enabled})}},tabs:{query:async()=>[{id:7,url:'https://central-cop-escalonamentos.vercel.app/'}],sendMessage:async(id,msg)=>{calls.push(msg);return msg.type==='COP_MONITOR_VALIDATE'?{valid}:{ok:true,candidates:[candidate]};}}}};
 vm.runInNewContext(background,scope);
 const message={type:'COP_MONITOR_PREPARE',context,contactId:id,revision,rowKey:id};
 const prepared=[];const prepare=async request=>{prepared.push(request);return {ok:true};};
 await scope.CopMonitorBackground.run(message,{tab:{id:8}},prepare);
 assert.equal(prepared.length,1);assert.equal(prepared[0].type,'COP_PREPARE_MAX');assert.equal(calls.at(-1).type,'COP_MONITOR_VALIDATE');
 valid=false;await scope.CopMonitorBackground.run(message,{tab:{id:8}},prepare);assert.equal(prepared.length,1);
 enabled=false;assert.equal((await scope.CopMonitorBackground.run(message,{tab:{id:8}},prepare)).code,'MONITOR_DISABLED');
});
