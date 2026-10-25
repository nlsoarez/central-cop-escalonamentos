import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {MAX_URL,maxWindowFeatures,openMaxWindow} from '../src/max-window.mjs';
import {regionMap} from '../src/region-maps.mjs';
import {createSessionRecovery} from '../src/session-lifecycle.mjs';

test('MAX abre somente o endereço autorizado em popup compacto sem acesso ao opener',()=>{
 let args;
 openMaxWindow({screen:{availWidth:1920,availHeight:1080},open:(...a)=>args=a});
 assert.equal(args[0],MAX_URL);assert.equal(args[0],'https://max.niceincontact.com/index.html');
 assert.match(args[2],/popup=yes,width=360,height=820/);assert.match(args[2],/noopener,noreferrer/);
 assert.match(maxWindowFeatures({availWidth:320,availHeight:700}),/width=320,height=700/);
});
test('tema inicial aceita apenas preferência local clara ou escura, inclusive armazenamento bloqueado',async()=>{
 const source=await readFile(new URL('../src/theme.js',import.meta.url),'utf8');
 for(const [saved,expected]of [['dark','dark'],['light','light'],['<invalid>','light'],[null,'light']]){
  const document={documentElement:{dataset:{}}};vm.runInNewContext(source,{document,localStorage:{getItem:()=>saved}});assert.equal(document.documentElement.dataset.theme,expected);
 }
 const document={documentElement:{dataset:{}}};vm.runInNewContext(source,{document,localStorage:{getItem:()=>{throw Error('blocked');}}});assert.equal(document.documentElement.dataset.theme,'light');
});
test('regiões têm contornos vetoriais locais e não carregam conteúdo externo',()=>{
 const maps=['RJ','ES','MG','CO','NE','NO','BA'].map(regionMap);
 assert.equal(new Set(maps).size,7);
 for(const map of maps){assert.match(map,/<path d="M/);assert.match(map,/aria-hidden="true"/);assert.doesNotMatch(map,/https?:|script|onload|foreignObject/);}
 assert.equal(regionMap('unknown'),'');
});
test('revalidação silenciosa mantém interface até resultado e continua bloqueando sessão revogada ou indisponível',async()=>{
 let complete;const events=[];
 const recover=createSessionRecovery({session:()=>new Promise(r=>complete=r),checking:()=>events.push('mask'),verified:()=>events.push('valid'),signedOut:()=>events.push('logout'),unavailable:()=>events.push('offline')});
 const pending=recover({quiet:true});assert.deepEqual(events,[]);complete({active:true});await pending;assert.deepEqual(events,['valid']);
 const revoked=createSessionRecovery({session:async()=>null,signedOut:()=>events.push('logout'),verified:()=>assert.fail(),unavailable:()=>assert.fail()});await revoked({quiet:true});assert.equal(events.at(-1),'logout');
 const failed=createSessionRecovery({session:async()=>{throw Error('network');},unavailable:()=>events.push('offline')});await failed({quiet:true});assert.equal(events.at(-1),'offline');
});
