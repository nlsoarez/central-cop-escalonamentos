import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../extension/', import.meta.url);
const files = Object.fromEntries(await Promise.all(['policy.js','background.js','portal.js','max.js','manifest.json'].map(async file => [file, await readFile(new URL(file, root), 'utf8')])));
function policy() { const scope = vm.createContext({URL}); vm.runInContext(files['policy.js'], scope); return scope.CopMaxPolicy; }
const valid = (createdAt = Date.now()) => ({type: 'COP_PREPARE_MAX', phone: '+5511999990001', createdAt});
const sender = {id:'extension-test', frameId:0, url:'https://central-cop-escalonamentos.vercel.app/', tab:{id:1}};
test('extensão limita acesso aos dois sites, sem cookies, armazenamento ou execução remota', () => {
  const manifest = JSON.parse(files['manifest.json']);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.host_permissions, ['https://max.niceincontact.com/*']);
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.deepEqual(manifest.content_scripts.flatMap(c=>c.matches), ['https://central-cop-escalonamentos.vercel.app/*','https://max.niceincontact.com/index.html']);
  assert.ok(manifest.content_scripts.every(c=>c.all_frames === false));
});
test('contrato rejeita fonte, frame, telefone e validade incorretos', () => {
  const p = policy();
  assert.equal(p.trustedSender(sender, sender.id), true);
  for (const delta of [{id:'other'}, {frameId:1}, {url:'https://central-cop-escalonamentos.vercel.app.evil.test/'}, {url:'http://central-cop-escalonamentos.vercel.app/'}, {tab:null}]) assert.equal(p.trustedSender({...sender,...delta}, sender.id), false);
  assert.equal(p.request(valid(1000), 1500).phone, '+5511999990001');
  for (const phone of ['123', '+5511;alert(1)', '5511999990001', '+5500999990001', '+5511999990001\n', null]) assert.throws(()=>p.request({...valid(1000),phone},1500));
  for (const createdAt of [0, 200000, NaN, '1000']) assert.throws(()=>p.request(valid(createdAt),100000));
});
test('campo de discagem deve ser único, visível, editável e vazio', () => {
  const p = policy();
  const field = {isConnected:true, disabled:false, readOnly:false, value:'', getClientRects:()=>[{}], checkVisibility:()=>true};
  const doc = fields => ({querySelectorAll(selector) { assert.match(selector, /data-state="new"/); assert.match(selector, /data-context="none"/); return fields; }});
  assert.equal(p.field(doc([field])), field);
  for (const fields of [[], [field,field], [{...field,disabled:true}], [{...field,readOnly:true}], [{...field,checkVisibility:()=>false}], [{...field,value:'número já digitado'}]]) assert.throws(()=>p.field(doc(fields)));
});
function background(tabs = [{id:2,windowId:3,url:'https://max.niceincontact.com/index.html'}], result = {ok:true}, failure = '') {
  let listener; const effects = [];
  const scope = vm.createContext({URL, Date, chrome:{runtime:{id:sender.id,onMessage:{addListener(fn){listener=fn;}}},tabs:{query:async()=>tabs,sendMessage:async(...args)=>{effects.push(['send',...args]);return result;},update:async(...args)=>effects.push(['tab',...args])},windows:{update:async(...args)=>effects.push(['window',...args])}}});
  scope.importScripts = () => vm.runInContext(files['policy.js'],scope);
  if (failure === 'query') scope.chrome.tabs.query = async () => { throw Error('permission'); };
  if (failure === 'receiver') scope.chrome.tabs.sendMessage = async () => { throw Error('no receiver'); };
  if (failure === 'focus') scope.chrome.windows.update = async () => { throw Error('cannot focus'); };
  vm.runInContext(files['background.js'],scope);
  return {effects, request:(message=valid(),source=sender)=>new Promise(resolve=>listener(message,source,resolve))};
}
test('roteamento entrega só à única janela MAX e foca após aceite', async () => {
  const b = background(); assert.equal((await b.request()).ok,true);
  assert.deepEqual(b.effects.map(e=>e[0]),['send','tab','window']);
  assert.equal(b.effects[0][1],2); assert.equal(b.effects[0][2].phone,'+5511999990001');
  assert.deepEqual(Object.keys(b.effects[0][2]).sort(), ['createdAt','phone','type']);
});
test('roteamento não abre nova sessão e falha sem efeitos se MAX ausente ou ambíguo', async () => {
  for (const [tabs,code] of [[[],'NO_MAX'],[[{id:2,url:'https://evil.test/index.html'}],'NO_MAX'],[[{id:2,url:'https://max.niceincontact.com/index.html'},{id:3,url:'https://max.niceincontact.com/index.html'}],'MULTIPLE_MAX']]) {
    const b = background(tabs); assert.equal((await b.request()).code,code); assert.equal(b.effects.length,0);
  }
  const b = background(); assert.equal((await b.request(valid(),{...sender,frameId:1})).code,'UNTRUSTED_SOURCE'); assert.equal(b.effects.length,0);
});
test('erro do receptor não foca janela e duplo clique não entrega duas solicitações', async () => {
  const b = background(undefined,{ok:false,code:'BUSY'});
  assert.equal((await b.request()).code,'BUSY'); assert.deepEqual(b.effects.map(e=>e[0]),['send']);
  const c = background(); const first = c.request(); const second = c.request();
  assert.equal((await second).code,'BUSY'); assert.equal((await first).ok,true); assert.equal(c.effects.filter(e=>e[0]==='send').length,1);
});
test('diagnóstico diferencia consulta, receptor ausente e entrega sem foco', async () => {
  assert.equal((await background(undefined,undefined,'query').request()).code,'QUERY_FAILED');
  assert.equal((await background(undefined,undefined,'receiver').request()).code,'MAX_NOT_READY');
  const response = await background(undefined,undefined,'focus').request();
  assert.equal(response.ok,true); assert.equal(response.code,'PREPARED_NO_FOCUS');
});
// Execute the actual MAX content script against a minimal DOM double. Only the
// explicit fill gesture may change the input; no call-control API is provided.
function maxFixture() {
  let listener; const nodes=[]; let scheduled;
  class Node {
    constructor(tag){this.tag=tag;this.style={};this.children=[];this.handlers={};nodes.push(this);}
    setAttribute(){} append(...items){this.children.push(...items);} attachShadow(){return new Node('shadow');}
    addEventListener(type,fn){this.handlers[type]=fn;} remove(){this.removed=true;}
  }
  class Input {set value(v){this.contents=v;} get value(){return this.contents||'';} focus(){this.focused=true;} dispatchEvent(e){this.events.push(e.type); if(e.key) this.keys.push({type:e.type,key:e.key,code:e.code,keyCode:e.keyCode,value:this.value,focused:this.focused});}}
  const field = new Input(); Object.assign(field,{isConnected:true,events:[],keys:[],getClientRects:()=>[{}],checkVisibility:()=>true});
  const scope = vm.createContext({URL,Date,HTMLInputElement:Input,KeyboardEvent:class {constructor(type,options){this.type=type;Object.assign(this,options);}},Event:class {constructor(type){this.type=type;}},location:{origin:'https://max.niceincontact.com',pathname:'/index.html'},document:{createElement:tag=>new Node(tag),documentElement:new Node('root'),querySelectorAll:()=>[field]},chrome:{runtime:{id:sender.id,onMessage:{addListener(fn){listener=fn;}}}},setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{}});
  scope.window=scope; scope.top=scope;
  vm.runInContext(files['policy.js'],scope); vm.runInContext(files['max.js'],scope);
  return {nodes,field,expire:()=>scheduled(),receive(message=valid(),source={id:sender.id}){let result;listener(message,source,r=>{result=r;});return result;}};
}
test('MAX exige confirmação, usa DDD automaticamente e preenche uma vez sem discar nem sobrescrever', async () => {
  const f=maxFixture(); assert.equal(f.receive().ok,true); assert.equal(f.field.value,'');
  const fill=f.nodes.find(n=>n.textContent==='Preencher campo');
  assert.equal(f.nodes.some(n=>n.tag==='select'),false);
  await fill.handlers.click({isTrusted:false}); assert.equal(f.field.value,'');
  f.field.value='ocupado'; await fill.handlers.click({isTrusted:true}); assert.equal(f.field.value,'ocupado');
  f.field.value=''; await fill.handlers.click({isTrusted:true}); assert.equal(f.field.value,'11 999990001 ');
  assert.deepEqual(f.field.events,['keydown','input','change','keyup']); assert.equal(fill.disabled,true);
  assert.deepEqual(f.field.keys.map(e=>e.key),[' ',' ']);
  assert.ok(f.field.keys.every(e=>e.focused && e.code==='Space' && e.keyCode===32));
  assert.equal(f.field.keys[1].value,'11 999990001 ');
  await fill.handlers.click({isTrusted:true}); assert.equal(f.field.events.length,4);
});
test('abre Novo uma única vez, espera o campo e preserva DDD 55', async () => {
  const p=policy(); let opened=false, clicks=0, waits=0;
  const field={isConnected:true,value:'',getClientRects:()=>[{}],checkVisibility:()=>true};
  const button={...field,click(){clicks++;}};
  const doc={querySelectorAll(selector){
    if(selector.startsWith('button')) return [button];
    if(selector.includes('input')) return opened?[field]:[];
    return [];
  }};
  assert.equal(await p.openField(doc,async()=>{waits++;opened=true;}),field);
  assert.equal(clicks,1); assert.equal(waits,1);
  await p.openField(doc); assert.equal(clicks,1);
  assert.equal(p.nationalPhone('+5555999990001'),'55 999990001 ');
  assert.equal(p.nationalPhone('+5521991212107'),'21 991212107 ');
});
test('não abre Novo com campo ocupado, diálogo existente ou botão ambíguo; espera é limitada', async () => {
  const p=policy(); let clicks=0;
  const visible={isConnected:true,value:'',getClientRects:()=>[{}],checkVisibility:()=>true,click(){clicks++;}};
  const doc=(fields,dialogs,buttons)=>({querySelectorAll(selector){return selector.startsWith('button')?buttons:selector.includes('input')?fields:dialogs;}});
  await assert.rejects(p.openField(doc([{...visible,value:'existente'}],[],[visible])),/FIELD_NOT_EMPTY/);
  await assert.rejects(p.openField(doc([],[visible],[visible])),/FIELD_UNAVAILABLE/);
  await assert.rejects(p.openField(doc([],[],[visible,visible])),/NEW_UNAVAILABLE/);
  assert.equal(clicks,0);
  let waits=0;
  await assert.rejects(p.openField(doc([],[],[visible]),async()=>{waits++;}),/FIELD_UNAVAILABLE/);
  assert.equal(clicks,1); assert.equal(waits,25);
});
test('MAX rejeita origem de mensagem indevida, bloqueia pendência e limpa ao expirar', () => {
  const f=maxFixture(); assert.equal(f.receive(valid(),{id:'other'}).ok,false); assert.equal(f.receive(valid(),{id:sender.id,tab:{id:1}}).ok,false);
  assert.equal(f.receive().ok,true); assert.equal(f.receive().code,'BUSY'); f.expire(); assert.equal(f.receive().ok,true);
});
