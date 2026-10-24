import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,resolveCluster,parseCsv,parseTables,filterContacts,importPreview,whatsappUrl,consultationContacts} from '../src/core.mjs';

test('DDD 55 nacional não é confundido com DDI 55',()=>{
 const p=normalizePhone('(55) 99999-0001');
 assert.equal(p.valid,true);assert.equal(p.e164,'5555999990001');
 assert.equal(p.display,'(55) 99999-0001');
});
test('DDI 55 é reconhecido somente quando o comprimento contém DDI + DDD',()=>{
 assert.equal(normalizePhone('+55 (21) 99999-0001').e164,'5521999990001');
 assert.equal(normalizePhone('55 21 3333-4444').e164,'552133334444');
 assert.equal(normalizePhone('021 99999-0001').valid,false);
});
test('telefone inválido não cria link de WhatsApp',()=>{
 assert.equal(whatsappUrl({phone_e164:'999'}),'');
 assert.equal(normalizePhone('21 1999-9999').valid,false);
 assert.equal(normalizePhone('').valid,false);
});
test('cluster de aba é reconhecido, nunca presumido pela posição',()=>{
 assert.equal(resolveCluster('RJ - Contatos'),'RJ');
 assert.equal(resolveCluster('Contatos MG'),'MG');
 assert.equal(resolveCluster('BA/SE'),'BA');
 assert.equal(resolveCluster('Aba número 1'),'');
 assert.equal(resolveCluster('RJ ES escalonamento'),'');
});
test('CSV respeita aspas, delimitadores e valores com quebra de linha',()=>{
 const rows=parseCsv('Cluster;Nome;Telefone;Observações\nRJ;"Nome, Exemplo";(21) 99999-0001;"linha 1;\nlinha 2"');
 assert.equal(rows.length,2);
 assert.equal(rows[1][1],'Nome, Exemplo');
 assert.equal(rows[1][3],'linha 1;\nlinha 2');
});
test('CSV truncado não vira uma prévia parcial publicável',()=>{
 assert.throws(()=>parseCsv('Cluster;Nome;Telefone\nRJ;"Campo sem fim;21999990001'),/aspas não encerradas/);
});
test('importação exige cluster explícito ou nome de aba',()=>{
 const tables=[{sheet:'Planilha1',rows:[['Nome','Telefone'],['João Exemplo','(21) 99999-0001']]}];
 const result=parseTables(tables);
 assert.equal(result.valid.length,0);
 assert.match(result.errors[0].message,/Cluster/);
});
test('importação detecta nomes das colunas por sinônimos e telefone',()=>{
 const tables=[{sheet:'Contatos RJ',rows:[['Responsável','Celular','Área','Nível'],['João Exemplo','(21) 99999-0001','Baixada','2']]}];
 const result=parseTables(tables);
 assert.equal(result.errors.length,0);
 assert.equal(result.valid[0].cluster,'RJ');
 assert.equal(result.valid[0].nivel,'2');
});
test('contato regional pode aparecer junto a localidade, mas respeita área',()=>{
 const rows=[
  {id:'1',cluster:'RJ',area:'Baixada',cidade:'Nova Iguaçu',scope:'local',full_name:'A',active:true},
  {id:'2',cluster:'RJ',area:'Baixada',cidade:'',scope:'regional',full_name:'B',active:true},
  {id:'3',cluster:'RJ',area:'Capital',cidade:'',scope:'regional',full_name:'C',active:true},
  {id:'4',cluster:'ES',area:'',cidade:'',scope:'regional',full_name:'D',active:true}
 ];
 const result=filterContacts(rows,{cluster:'RJ',area:'Baixada',cidade:'Nova Iguaçu'});
 assert.deepEqual(result.map(r=>r.id),['1','2']);
});

test('consulta sem região não mostra contatos, inclusive quando existe busca ou filtro antigo',()=>{
 const rows=[{id:'1',cluster:'RJ',area:'Área A',full_name:'Pessoa Exemplo',active:true}];
 assert.deepEqual(consultationContacts(rows,{}),[]);
 assert.deepEqual(consultationContacts(rows,{cluster:'',area:'Área A',query:'Pessoa'}),[]);
 assert.deepEqual(consultationContacts(rows,{cluster:'inexistente'}),[]);
 assert.equal(filterContacts(rows,{}).length,1);
});

test('consulta selecionada respeita subgrupo e inclui gestores gerais da mesma região',()=>{
 const rows=[
  {id:'a',cluster:'RJ',area:'Área A',full_name:'A',active:true},
  {id:'b',cluster:'RJ',area:'Área B',full_name:'B',active:true},
  {id:'global',cluster:'RJ',area:'',full_name:'C',active:true},
  {id:'other',cluster:'MG',area:'Área A',full_name:'D',active:true}
 ];
 assert.deepEqual(consultationContacts(rows,{cluster:'RJ',area:'Área A'}).map(c=>c.id),['a','global']);
 assert.deepEqual(consultationContacts(rows,{cluster:'MG'}).map(c=>c.id),['other']);
});
test('importação padrão não remove contatos de outras regionais',()=>{
 const existing=[
  {cluster:'RJ',area:'A',cidade:'',topologia:'',full_name:'Ana',cargo:'Supervisão',nivel:'1',phone_e164:'5521999990001'},
  {cluster:'MG',area:'B',cidade:'',topologia:'',full_name:'Beto',cargo:'Coordenação',nivel:'2',phone_e164:'5531999990002'}
 ];
 const incoming=[{...existing[0],phone_e164:'5521999990008'}];
 assert.equal(importPreview(existing,incoming,'merge').removed,0);
 assert.equal(importPreview(existing,incoming,'replace_clusters').removed,0);
 const different=[{...incoming[0],full_name:'Carla'}];
 assert.equal(importPreview(existing,different,'replace_clusters').removed,1);
});
test('duplicidade no mesmo arquivo é identificada antes da publicação',()=>{
 const contact={cluster:'RJ',area:'',cidade:'',topologia:'',full_name:'João',cargo:'Supervisor',nivel:'1'};
 assert.equal(importPreview([],[contact,contact]).duplicates,1);
});

test('datas brasileiras são normalizadas na importação e datas inválidas rejeitadas',()=>{
 const valid=parseTables([{sheet:'RJ',rows:[['Nome','Telefone','Data início'],['João Silva','(21) 99999-0001','24/10/2026']]}]);
 assert.equal(valid.valid[0].valid_from,'2026-10-24');
 const invalid=parseTables([{sheet:'RJ',rows:[['Nome','Telefone','Data início'],['João Silva','(21) 99999-0001','31/02/2026']]}]);
 assert.equal(invalid.valid.length,0);
 assert.match(invalid.errors[0].message,/Data/);
});
