import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function worker({offline=false}={}){const handlers={},added=[],written=[];let activated=0;const context=vm.createContext({URL,self:{location:{origin:'https://cop.invalid'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>activated++},fetch:async()=>{if(offline)throw Error('offline');return {ok:true,type:'basic',clone(){return this;}};},caches:{open:async()=>({addAll:async files=>added.push(...files),put:async path=>written.push(path)}),keys:async()=>[],match:async()=>({offline:true})}});vm.runInContext(sw,context);return {handlers,added,written,activated:()=>activated};}
test('cache estático não contém aplicação, configuração, API ou dados privados',async()=>{
 const w=worker();let done;w.handlers.install({waitUntil:p=>done=p});await done;
 assert.ok(w.added.includes('/offline.html'));assert.ok(w.added.includes('/manifest.webmanifest'));
 assert.ok(w.added.every(p=>p==='/offline.html'||p==='/manifest.webmanifest'||p.startsWith('/assets/')));
 for(const url of ['https://api.invalid/rest/v1/cop_contacts','https://cop.invalid/config.js','https://cop.invalid/src/store.mjs','https://cop.invalid/rest/v1/cop_profiles','https://cop.invalid/assets/styles.css?token=synthetic']){
  let intercepted=false;w.handlers.fetch({request:{url,method:'GET',headers:new Headers(),mode:'cors'},respondWith(){intercepted=true;}});assert.equal(intercepted,false,url);
 }
 let intercepted=false;w.handlers.fetch({request:{url:'https://cop.invalid/assets/styles.css',method:'GET',headers:new Headers({authorization:'Bearer synthetic'}),mode:'cors'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);assert.equal(w.written.length,0);
});
test('manifest tem ícones válidos e standalone; arquivos existem sem credenciais',async()=>{
 const body=await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8');const manifest=JSON.parse(body);
 assert.equal(manifest.display,'standalone');assert.equal(manifest.short_name,'Central COP');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
 assert.doesNotMatch(body,/token|password|supabaseAnonKey/i);
 for(const icon of manifest.icons){const bytes=await readFile(new URL('..'+icon.src,import.meta.url));assert.equal(bytes.readUInt32BE(16),parseInt(icon.sizes));assert.equal(bytes.readUInt32BE(20),parseInt(icon.sizes));}
});
test('navegação offline retorna apenas fallback estático e atualização exige comando explícito',async()=>{
 const w=worker({offline:true});let response;
 w.handlers.fetch({request:{url:'https://cop.invalid/',mode:'navigate',method:'GET',headers:new Headers()},respondWith:p=>response=p});
 assert.equal((await response).offline,true);assert.equal(w.written.length,0);
 assert.equal(w.activated(),0);w.handlers.message({data:{type:'unrelated'}});assert.equal(w.activated(),0);
 w.handlers.message({data:{type:'COP_ACTIVATE_UPDATE'}});assert.equal(w.activated(),1);
});
