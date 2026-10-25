import test from 'node:test';
import assert from 'node:assert/strict';
import {dialUrl,operationalNotes,contactShareText,contactVCard,shareContact} from '../src/contact-actions.mjs';
import {createSessionRecovery} from '../src/session-lifecycle.mjs';
const contact={full_name:'Pessoa Sintética',cargo:'Supervisão',cluster:'RJ',cidade:'Cidade Exemplo',nivel:'1',phone_e164:'5521999990001',notes:'Origem: fonte privada, linha 10\nAbrangência original: área técnica\nMercado / área original: bloco\nPlantão após 18h'};
test('discagem brasileira preserva DDD 55 e rejeita número inválido',()=>{
 assert.equal(dialUrl(contact),'tel:+5521999990001');assert.equal(dialUrl({phone_display:'(55) 99999-0001'}),'tel:+5555999990001');assert.equal(dialUrl({phone_e164:'123'}),'');
});
test('cartões e compartilhamento ocultam rastreabilidade sem modificar o registro',()=>{
 assert.equal(operationalNotes(contact.notes),'Plantão após 18h');assert.match(contact.notes,/Origem:/);
 const shared=contactShareText(contact);assert.match(shared,/Nome: Pessoa Sintética/);assert.doesNotMatch(shared,/Origem|Abrangência|fonte privada|Topologia:/);
});
test('vCard escapa injeção de linhas e mantém limites de bytes UTF-8',()=>{
 const card=contactVCard({...contact,full_name:'Á'.repeat(80)+'\r\nTEL:evil;,'});
 assert.match(card,/TEL;TYPE=VOICE:\+5521999990001/);assert.doesNotMatch(card,/\r\nTEL:evil/);assert.match(card,/\\nTEL:evil\\;\\,/);
 assert.ok(card.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));assert.doesNotMatch(card,/fonte privada/);
});
test('compartilha vCard quando suportado, texto senão, cópia apenas sem API e cancelamento silencioso',async()=>{
 let payload,copies=0;
 const files={canShare:()=>true,share:async p=>{payload=p;}};
 assert.equal((await shareContact(contact,{nav:files})).kind,'vcard');assert.equal(payload.files[0].type,'text/vcard');
 assert.equal((await shareContact(contact,{nav:{canShare:()=>false,share:files.share}})).kind,'text');assert.match(payload.text,/Telefone:/);
 assert.equal((await shareContact(contact,{nav:{},copy:async()=>copies++})).kind,'copied');assert.equal(copies,1);
 assert.equal((await shareContact(contact,{nav:{share:async()=>{throw Object.assign(Error(),{name:'AbortError'});}},copy:async()=>copies++})).kind,'cancelled');assert.equal(copies,1);
 await assert.rejects(shareContact(contact,{nav:{share:async()=>{throw Error('blocked');}},copy:async()=>copies++}));assert.equal(copies,1);
});
test('retorno do segundo plano deduplica verificações e não confunde falha de rede com logout',async()=>{
 let resolve,called=0;const events=[];
 const recover=createSessionRecovery({session:()=>{called++;return new Promise(r=>resolve=r);},checking:()=>events.push('checking'),verified:()=>events.push('verified'),signedOut:()=>events.push('logout'),unavailable:()=>events.push('offline')});
 const a=recover(),b=recover();assert.equal(called,1);assert.equal(a,b);resolve({active:true});await a;assert.deepEqual(events,['checking','verified']);
 const failed=createSessionRecovery({session:async()=>{throw Error('network');},signedOut:()=>events.push('logout'),unavailable:()=>events.push('offline')});await failed();assert.equal(events.at(-1),'offline');assert.ok(!events.includes('logout'));
});
test('revogação exige login e resposta anterior ao logout não repõe estado privado',async()=>{
 let generation=0,resolve,authorized=0,logouts=0;
 const recovery=createSessionRecovery({session:()=>new Promise(r=>resolve=r),epoch:()=>generation,verified:()=>authorized++,signedOut:()=>logouts++,unavailable:()=>{}});
 const pending=recovery();generation++;resolve({active:true});await pending;assert.equal(authorized,0);
 const revoked=createSessionRecovery({session:async()=>null,verified:()=>authorized++,signedOut:()=>logouts++,unavailable:()=>{}});await revoked();assert.equal(logouts,1);
});
