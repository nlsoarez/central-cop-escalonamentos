import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkbook} from '../src/workbook.mjs';
import {filterContacts,importPreview,topologyValues} from '../src/core.mjs';

const header=['UF','MERCADO','NOME','CARGO','E-MAIL','TELEFONE'];
const person=(area='RJ',market='GPON',name='Pessoa Exemplo',phone='(21) 99999-0001')=>[area,market,name,'SUPERVISOR','exemplo@example.invalid',phone];
const block=(sheet,rows,merges=[])=>({sheet,rows,merges});

test('blocos repetidos preservam áreas, tecnologias e níveis do título',()=>{
 const p=parseWorkbook([block('RJ',[
  ['Área Exemplo A'],['1º NÍVEL DE ESCALONAMENTO'],['SUPERVISOR REDE EXTERNA'],header,person(),
  ['2º NÍVEL DE ESCALONAMENTO'],['REGIONAL','ÁREA','NOME','CARGO','E-MAIL','TELEFONE'],person(),
  ['Área Exemplo B'],['1° NÍVEL DE ESCALONAMENTO'],['TÉCNICO I - REDE EXTERNA (PONTO FOCAL)'],header,person()
 ])]);
 assert.equal(p.errors.length,0);assert.equal(p.valid.length,3);
 assert.deepEqual(p.valid.map(c=>[c.area,c.nivel,c.topologia]),[['Área Exemplo A','1','GPON'],['Área Exemplo A','2','GPON'],['Área Exemplo B','1','GPON']]);
});

test('células mescladas verticais replicam só nas linhas explicitamente mescladas',()=>{
 const h=['OPERAÇÃO','UF','MERCADO','NOME','CARGO','E-MAIL','TELEFONE'];
 const p=parseWorkbook([block('Norte',[
  ['1º NÍVEL DE ESCALONAMENTO'],h,
  ['Cidade A','PA','GPON','Pessoa Exemplo','SUPERVISOR','','(91) 99999-0001'],
  ['Cidade B','PA','GPON','','','',''],
  ['Cidade C','PA','GPON','','','','']
 ],[3,4,5,6].map(c=>({s:{r:2,c},e:{r:3,c}})))]);
 assert.deepEqual(p.valid.map(c=>c.cidade),['Cidade A','Cidade B']);
 assert.equal(p.errors.length,1);assert.equal(p.errors[0].row,5);
});

test('mesclagem horizontal de título não vira dado de contato',()=>{
 const p=parseWorkbook([block('Espírito Santo',[
  ['1º NÍVEL DE ESCALONAMENTO'],['SUPERVISORES REDE EXTERNA'],
  ['MERCADO','NOME','CARGO','E-MAIL','TELEFONE'],['GPON','Pessoa Exemplo','Supervisor','','(27) 99999-0001']
 ],[{s:{r:0,c:0},e:{r:0,c:4}}])]);
 assert.equal(p.valid.length,1);assert.equal(p.errors.length,0);
});

test('MG usa referência por nome e preserva nível explícito divergente',()=>{
 const p=parseWorkbook([
  block('MG Cidades x Cluster',[['CIDADE','cluster'],['Cidade A','Cluster Sul MG'],['Cidade B','Cluster Sul MG'],['Cidade C','Cluster Metropolitana BH']]),
  block('MG',[
   ['', '', '2º NÍVEL DE ESCALONAMENTO'],['CLUSTER','NIVEL','MERCADO','NOME','CARGO','E-MAIL','TELEFONE'],
   ['SUL MG','N3','HFC / GPON','Pessoa Exemplo','COORDENADOR','','031-99999-0001'],
   ['CENTRAL','N2','GPON','Outra Pessoa','COORDENADOR','','(31) 99999-0002']
  ])
 ]);
 assert.equal(p.errors.length,0);assert.equal(p.valid.length,3);
 assert.deepEqual(p.valid.slice(0,2).map(c=>c.cidade),['Cidade A','Cidade B']);
 assert.equal(p.valid[0].nivel,'3');assert.equal(p.valid[0].phone_e164,'5531999990001');
 assert.equal(p.valid[2].cidade,'Cidade C');
 assert.ok(p.warnings.some(w=>w.message.includes('difere')));
 assert.equal(p.valid[2].area,'CENTRAL');
});

test('MG mercado restrito a cidades não é ampliado para todo o cluster',()=>{
 const p=parseWorkbook([
  block('MG Cidades x Cluster',[['CIDADE','cluster'],['Cidade A','Cluster Leste MG'],['Cidade B','Cluster Leste MG'],['Cidade C','Cluster Leste MG']]),
  block('MG',[['1º NÍVEL DE ESCALONAMENTO'],['CLUSTER','NIVEL','MERCADO','NOME','CARGO','E-MAIL','TELEFONE'],['LESTE MG','N1','Cidade A; Cidade B (HFC/GPON)','Pessoa Exemplo','Supervisor','','(31) 99999-0001']])
 ]);
 assert.deepEqual(p.valid.map(c=>c.cidade),['Cidade A','Cidade B']);
});

test('referência MG com cidade em clusters distintos bloqueia a publicação',()=>{
 const p=parseWorkbook([block('MG Cidades x Cluster',[['CIDADE','cluster'],['Cidade A','Cluster Leste MG'],['Cidade A','Cluster Sul MG']])]);
 assert.match(p.errors[0].message,/clusters diferentes/);
});

test('Bahia e Sergipe reconhecida e dois telefones ficam preservados',()=>{
 const p=parseWorkbook([block('Bahia e Sergipe',[
  ['1º NÍVEL DE ESCALONAMENTO'],header,person('SE','GPON','Pessoa Exemplo','(79) 99999-0001     (79) 99999-0002')
 ])]);
 assert.equal(p.errors.length,0);assert.equal(p.valid[0].cluster,'BA');
 assert.equal(p.valid[0].phone_e164,'5579999990001');
 assert.match(p.valid[0].notes,/Telefone adicional: \(79\) 99999-0002/);
});

test('cada linha da fonte é preservada, inclusive repetições iguais e telefones distintos',()=>{
 const p=parseWorkbook([block('RJ',[['1º NÍVEL DE ESCALONAMENTO'],header,person(),person()])]);
 assert.equal(p.valid.length,2);assert.equal(p.errors.length,0);assert.equal(importPreview([],p.valid).duplicates,0);
 assert.deepEqual(p.valid.map(c=>c.source_occurrence),[1,2]);
 assert.match(p.valid[0].notes,/linha 3/);assert.match(p.valid[1].notes,/linha 4/);
 assert.equal(p.warnings.length,0);
 const conflict=parseWorkbook([block('RJ',[['1º NÍVEL DE ESCALONAMENTO'],header,person(),person('RJ','GPON','Pessoa Exemplo','(21) 99999-0002')])]);
 assert.equal(conflict.errors.length,0);assert.equal(conflict.valid.length,2);
 assert.deepEqual(conflict.valid.map(c=>c.phone_e164),['5521999990001','5521999990002']);
 assert.equal(importPreview([],conflict.valid).duplicates,0);
});

test('um gestor em áreas, cidades, topologias ou níveis distintos mantém cada abrangência',()=>{
 const p=parseWorkbook([block('RJ',[
  ['Área A'],['1º NÍVEL DE ESCALONAMENTO'],header,person(),person('RJ','FIBRA'),
  ['2º NÍVEL DE ESCALONAMENTO'],header,person(),
  ['Área B'],['1º NÍVEL DE ESCALONAMENTO'],header,person()
 ]),block('Norte',[
  ['1º NÍVEL DE ESCALONAMENTO'],['OPERAÇÃO','UF','MERCADO','NOME','CARGO','E-MAIL','TELEFONE'],
  ['Cidade A','PA','GPON','Pessoa Exemplo','Supervisor','','(91) 99999-0001'],
  ['Cidade B','PA','GPON','Pessoa Exemplo','Supervisor','','(91) 99999-0001']
 ])]);
 assert.equal(p.errors.length,0);assert.equal(p.valid.length,6);
 assert.ok(p.valid.every(c=>c.source_occurrence===1));
 assert.equal(importPreview([],p.valid).duplicates,0);
 assert.equal(importPreview(p.valid,p.valid).added,0);
 assert.equal(importPreview(p.valid,p.valid).unchanged,6);
});

test('duas pessoas alinhadas na mesma célula recebem seus próprios telefones e e-mails',()=>{
 const p=parseWorkbook([block('Bahia e Sergipe',[
  ['1º NÍVEL DE ESCALONAMENTO'],header,
  ['SE','GPON','Pessoa A       Pessoa B','Supervisor','a@example.invalid     b@example.invalid','(79) 99999-0001      (79) 99999-0002']
 ])]);
 assert.equal(p.errors.length,0);assert.equal(p.valid.length,2);
 assert.deepEqual(p.valid.map(c=>[c.full_name,c.phone_e164]),[['Pessoa A','5579999990001'],['Pessoa B','5579999990002']]);
 assert.match(p.valid[1].notes,/b@example.invalid/);assert.ok(!p.valid[1].notes.includes('a@example.invalid'));
 assert.ok(p.warnings.some(w=>w.message.includes('2 pessoas')));
});

test('pessoas agrupadas com contagens divergentes bloqueiam em vez de adivinhar telefone',()=>{
 const p=parseWorkbook([block('Bahia e Sergipe',[
  ['1º NÍVEL DE ESCALONAMENTO'],header,
  ['SE','GPON','Pessoa A       Pessoa B','Supervisor','a@example.invalid','(79) 99999-0001      (79) 99999-0002']
 ])]);
 assert.equal(p.valid.length,0);assert.match(p.errors[0].message,/inequívoca/);
});

test('organograma é avisado e CSV genérico continua validado',()=>{
 const p=parseWorkbook([block('RJ organograma',[['Visual']]),block('CSV',[['Cluster','Nome','Telefone'],['ES','Pessoa Exemplo','(27) 99999-0001']])]);
 assert.equal(p.errors.length,0);assert.equal(p.valid.length,1);assert.equal(p.sheets[0].kind,'organogram');
 assert.ok(p.warnings.some(w=>w.message.includes('Organograma')));
 const invalid=parseWorkbook([block('Desconhecida',[['Nada']])]);
 assert.equal(invalid.errors.length,1);
});

test('consulta por cidade respeita UF e inclui gestores da região inteira',()=>{
 const contacts=[
  {id:'local',cluster:'NO',area:'PA',cidade:'Cidade A',scope:'local',full_name:'A'},
  {id:'other',cluster:'NO',area:'AM',cidade:'',scope:'regional',full_name:'B'},
  {id:'state',cluster:'NO',area:'PA',cidade:'',scope:'regional',full_name:'C'},
  {id:'global',cluster:'NO',area:'',cidade:'',scope:'regional',full_name:'D'}
 ];
 assert.deepEqual(filterContacts(contacts,{cluster:'NO',cidade:'Cidade A'}).map(c=>c.id),['local','state','global']);
});

test('filtro de tecnologia reconhece mercado composto preservando o texto original',()=>{
 const c={cluster:'MG',full_name:'Pessoa',topologia:'Cidade A (HFC FO / GPON / EMPRESARIAL)'};
 assert.deepEqual(topologyValues(c.topologia),['GPON','HFC','FIBRA','EMPRESARIAL']);
 assert.equal(filterContacts([c],{topologia:'GPON'}).length,1);
 assert.equal(filterContacts([c],{topologia:'COAXIAL'}).length,0);
});
