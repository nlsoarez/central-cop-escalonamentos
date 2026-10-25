import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {regionMap} from '../src/region-maps.mjs';
import {createSessionRecovery} from '../src/session-lifecycle.mjs';

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
