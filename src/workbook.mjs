// Leitura local do modelo de escalonamento em blocos. Não contém dados reais.
import {normalizeText,normalizePhone,resolveCluster,parseTables,contactKey,sameContactData} from './core.mjs';

const text=v=>String(v??'').trim();
const key=normalizeText;
const levelOf=v=>key(v).match(/^(\d+)\s*[º°oª]?\s*nivel de escalonamento/)?.[1]||'';
const areaKey=v=>key(v).replace(/^cluster\s+/,'').replace(/\s+mg$/,'').trim();
// Associação operacional confirmada pelo proprietário para este modelo de MG.
const mgAreaKey=v=>areaKey(v)==='central'?'metropolitana bh':areaKey(v);
const phonesIn=value=>{
 const whole=normalizeSourcePhone(value);
 if(whole.valid)return [whole];
 // Dois números completos separados por espaços, quebra de linha, barra ou ponto e vírgula.
 const pieces=text(value).match(/(?:\+?55\s*)?\(?0?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4}/g)||[];
 const rest=pieces.reduce((s,p)=>s.replace(p,''),text(value)).replace(/[\s/;,|]+/g,'');
 const parsed=pieces.map(normalizeSourcePhone);
 return !rest&&parsed.length>1&&parsed.every(p=>p.valid)?parsed:[whole];
};
function normalizeSourcePhone(value){
 // O zero de acesso nacional é aceito neste modelo somente com DDD + assinante completos.
 const digits=text(value).replace(/\D/g,'');
 return normalizePhone(/^0\d{10,11}$/.test(digits)?digits.slice(1):value);
}
function headerOf(row){
 const cells=row.map(key);
 return cells.includes('nome')&&cells.includes('telefone')&&cells.includes('cargo')
  ? Object.fromEntries(cells.map((v,i)=>[v,i]).filter(([v])=>v)):null;
}
function expandMerges(table){
 const rows=table.rows.map(r=>[...r]);
 for(const range of table.merges||[]){
  // Coordenadas absolutas, base zero, recebidas diretamente do SheetJS.
  const {s,e}=range;
  if(!s||!e||s.c!==e.c||s.r===e.r)continue;
  const value=rows[s.r]?.[s.c];
  for(let r=s.r+1;r<=e.r;r++){
   rows[r]||=[];
   if(!text(rows[r][s.c]))rows[r][s.c]=value;
  }
 }
 return rows;
}
function mappingFrom(tables,errors,warnings){
 const groups=new Map();
 const table=tables.find(t=>key(t.sheet)==='mg cidades x cluster');
 if(!table)return groups;
 const header=table.rows.findIndex(r=>key(r[0])==='cidade'&&key(r[1])==='cluster');
 if(header<0){errors.push({sheet:table.sheet,row:0,message:'Referência de cidades sem cabeçalhos Cidade e Cluster'});return groups;}
 const seen=new Map();
 table.rows.slice(header+1).forEach((r,i)=>{
  if(!r.some(v=>text(v)))return;
  const city=text(r[0]),area=areaKey(r[1]);
  if(!city||!area){errors.push({sheet:table.sheet,row:header+i+2,message:'Cidade ou cluster de referência ausente'});return;}
  if(seen.has(key(city))&&seen.get(key(city))!==area){errors.push({sheet:table.sheet,row:header+i+2,message:'Cidade associada a clusters diferentes'});return;}
  seen.set(key(city),area);
  if(!groups.has(area))groups.set(area,[]);
  if(!groups.get(area).some(v=>key(v)===key(city)))groups.get(area).push(city);
 });
 warnings.push({sheet:table.sheet,row:0,message:`Referência utilizada: ${seen.size} cidades, ${groups.size} áreas. As associações são feitas por nome, sem aproximação.`});
 return groups;
}
function citiesFromMarket(market){
 // O prefixo antes das tecnologias contém localidades explícitas em parte dos blocos MG.
 const prefix=market.split(/\(?\s*(?:HFC|GPON|EMPRESARIAL|BKB|RESIDENCIAL|RESID\b)/i)[0].trim();
 return prefix?prefix.split(/[;,]/).map(text).filter(Boolean):[];
}
function stateCities(value){
 const m=value.match(/^[A-Z]{2}\s*-\s*(.+)$/);
 if(!m||/^(metropolitana|interior|cidades|entorno)/i.test(m[1]))return [];
 return m[1].split(/\s*[,/]\s*/).map(text).filter(Boolean);
}
export function parseWorkbook(tables){
 const valid=[],errors=[],warnings=[],sheets=[];
 const groups=mappingFrom(tables,errors,warnings);
 const sources=new Map();
 for(const table of tables){
  const sheetKey=key(table.sheet);
  if(sheetKey==='mg cidades x cluster'){sheets.push({sheet:table.sheet,kind:'reference',contacts:0});continue;}
  if(sheetKey==='rj organograma'){
   warnings.push({sheet:table.sheet,row:0,message:'Organograma visual não importado como contato. O diretório usa as linhas das abas de escalonamento.'});
   sheets.push({sheet:table.sheet,kind:'organogram',contacts:0});continue;
  }
  const rows=expandMerges(table);
  const blockModel=rows.some(r=>r.some(v=>levelOf(v)))&&rows.some(r=>headerOf(r)&&r.some(v=>key(v)==='mercado'));
  if(!blockModel){const p=parseTables([table]);valid.push(...p.valid);errors.push(...p.errors);sheets.push({sheet:table.sheet,kind:'flat',contacts:p.valid.length});continue;}
  const cluster=resolveCluster(table.sheet);
  let headers=null,level='',section='',count=0;
  const records=[];
  const warn=(row,message)=>warnings.push({sheet:table.sheet,row,message});
  for(let i=0;i<rows.length;i++){
   const row=rows[i],values=row.map(text),populated=values.filter(Boolean);
   if(!populated.length)continue;
   const titleLevel=values.map(levelOf).find(Boolean);
   if(titleLevel){level=titleLevel;headers=null;continue;}
   const h=headerOf(row);
   if(h){headers=h;continue;}
   if(populated.length===1){
    const title=populated[0];
    if(/^(?:e?scalonamento|supervisores?\b|coordenador(?:es|e)?\b|gerentes?\b|diretor(?:es)?\b)/i.test(title))continue;
    section=title;headers=null;continue;
   }
   if(!headers){errors.push({sheet:table.sheet,row:i+1,message:'Linha de dados fora de um bloco com cabeçalho reconhecido'});continue;}
   const get=(...names)=>{for(const n of names)if(headers[n]!==undefined)return values[headers[n]]||'';return '';};
   const name=get('nome'),rawPhone=get('telefone');
   if(!name&&!rawPhone){errors.push({sheet:table.sheet,row:i+1,message:'Linha preenchida sem nome ou telefone no bloco'});continue;}
   const phones=phonesIn(rawPhone);
   const rawArea=get('cluster','uf','regional'),market=get('mercado','área','area');
   const rawLevel=get('nivel','nível')||(headers.cluster!==undefined&&headers.nome>2?values[1]:'');
   const explicitLevel=rawLevel.match(/^N?(\d+)$/i)?.[1]||'';
   if(rawLevel&&!explicitLevel){errors.push({sheet:table.sheet,row:i+1,message:'Nível da coluna inválido. Use N1, N2 ou um número.'});continue;}
   const actualLevel=explicitLevel||level;
   if(explicitLevel&&level&&explicitLevel!==level)warn(i+1,`Nível da coluna (${rawLevel}) difere do título do bloco (${level}). Preservado o nível da coluna.`);
   if(!cluster||!name||!phones.every(p=>p.valid)||!actualLevel){
    errors.push({sheet:table.sheet,row:i+1,message:[!cluster?'Cluster da aba ausente ou ambíguo':'',!name?'Nome obrigatório':'',!phones.every(p=>p.valid)?phones.find(p=>!p.valid).error:'',!actualLevel?'Nível ausente':''].filter(Boolean).join('; ')});continue;
   }
   let area='',cities=[],topology=market;
   if(cluster==='RJ'){area=section;}
   else if(cluster==='MG'){
    area=/^minas$/i.test(rawArea)?'':rawArea;
    if(area){
     cities=citiesFromMarket(market);
     if(!cities.length)cities=groups.get(mgAreaKey(area))||[];
     if(!cities.length)warn(i+1,`Área "${area}" sem cidades associadas na referência. Abrangência mantida pela área, sem inventar vínculo de cidade.`);
    }
    if(/^(mg|minas gerais)$/i.test(market))topology='';
   }else if(cluster==='NO'){
    area=/^todas$/i.test(get('uf'))?'':get('uf');
    const operation=get('operação','operacao');
    if(operation&&resolveCluster(operation)!==cluster)cities=[operation];
   }else if(cluster==='NE'||cluster==='BA'||cluster==='CO'){
    area=rawArea;
    if(/^(ba\/se|ba\/se - nordeste|centro oeste)$/i.test(market)){topology='';}
    cities=stateCities(rawArea);
    if(cluster==='NE'&&/^[A-Z]{2}(?:\s*-|$)/.test(rawArea))area=rawArea.slice(0,2);
    if(cluster==='BA'&&/^BA\/SE$/i.test(rawArea))area='';
    // BA tem listas de cidades depois do nome da área, preservadas como localidades explícitas.
    const ba=rawArea.match(/^(BA\s*-\s*(?:METROPOLITANA|INTERIOR))\s{2,}(.+)$/i);
    if(ba){area=ba[1];cities=ba[2].split(',').map(text).filter(Boolean);}
   }else if(cluster==='ES'){
    if(/^(esp[ií]rito santo)$/i.test(market))topology='';
   }
   const names=name.split(/\s{3,}|\r?\n/).map(text).filter(Boolean);
   const emails=get('e-mail').split(/\s{3,}|\r?\n/).map(text).filter(Boolean);
   const splitPeople=names.length>1&&phones.length===names.length&&emails.length===names.length;
   if(names.length>1&&phones.length>1&&!splitPeople){errors.push({sheet:table.sheet,row:i+1,message:'Vários nomes e telefones sem correspondência inequívoca com os e-mails. Separe as pessoas em linhas.'});continue;}
   if(splitPeople)warn(i+1,`${names.length} pessoas na mesma linha: nomes, e-mails e telefones separados na ordem da célula. Confira as associações.`);
   else if(phones.length>1)warn(i+1,'Mais de um telefone: o primeiro é o principal e os demais ficam nas observações.');
   for(let person=0;person<(splitPeople?names.length:1);person++){
    const fullName=(splitPeople?names[person]:name).replace(/\s+/g,' ');
    if(fullName.length<2||fullName.length>160){errors.push({sheet:table.sheet,row:i+1,message:'Nome deve conter entre 2 e 160 caracteres'});continue;}
    const email=splitPeople?emails[person]:get('e-mail');
    const phone=splitPeople?phones[person]:phones[0];
    const notes=[email?'E-mail: '+email:'',`Origem: ${table.sheet}, linha ${i+1}`,rawArea?'Abrangência original: '+rawArea:'',market?'Mercado / área original: '+market:'',!splitPeople?phones.slice(1).map(p=>'Telefone adicional: '+p.display).join('; '):''].filter(Boolean).join('\n');
    records.push({row:i+1,cities,contact:{cluster,area,cidade:'',topologia:topology,full_name:fullName,cargo:get('cargo'),nivel:actualLevel,phone_e164:phone.e164,phone_display:phone.display,notes,scope:'regional',valid_from:null,valid_until:null,active:true}});
   }
  }
  // Uma coordenação por UF/área herda somente as cidades explicitamente listadas nessa mesma área.
  const citiesByArea=new Map();
  for(const r of records)if(r.cities.length&&r.contact.area){const a=areaKey(r.contact.area);citiesByArea.set(a,[...new Set([...(citiesByArea.get(a)||[]),...r.cities])]);}
  for(const r of records){
   const cities=r.cities.length?r.cities:citiesByArea.get(areaKey(r.contact.area))||[];
   for(const city of cities.length?cities:['']){
    const c={...r.contact,cidade:city,scope:city?'local':'regional'};
    const id=contactKey(c),previous=sources.get(id);
    // A origem muda por linha. Só colapsar cópias com os mesmos dados operacionais e observações.
    const comparable=v=>({...v,notes:v.notes.replace(/^Origem:.*(?:\n|$)/m,'')});
    if(previous){
     if(sameContactData(comparable(previous),comparable(c))){warn(r.row,'Repetição idêntica no mesmo contexto consolidada em um único contato.');continue;}
     errors.push({sheet:table.sheet,row:r.row,message:'Mesmo contato e abrangência com dados diferentes. Revise os registros antes de publicar.'});continue;
    }
    sources.set(id,c);valid.push(c);count++;
   }
  }
  sheets.push({sheet:table.sheet,kind:'blocks',contacts:count});
 }
 const mgCities=new Set(valid.filter(c=>c.cluster==='MG').map(c=>key(c.cidade)));
 const uncovered=[...groups.values()].flat().filter(city=>!mgCities.has(key(city)));
 if(uncovered.length)warnings.push({sheet:'MG Cidades x Cluster',row:0,message:`${uncovered.length} cidades da referência não têm contato local explicitamente associado nos blocos. Não foram atribuídos supervisores por aproximação. Consulte a área e os gestores regionais para esses casos.`});
 return {valid,errors,warnings,sheets};
}
