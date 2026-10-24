// Regras puras de consulta/importação. Não contém dados pessoais ou dependência do Supabase.
export const CLUSTERS = ['RJ', 'ES', 'MG', 'CO', 'NE', 'NO', 'BA'];
export const normalizeText = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

const FIELD_ALIASES = {
  cluster: ['cluster','regional cluster','regiao cop','regiao'],
  area: ['area','regiao operacional','subregiao','setor'],
  cidade: ['cidade','localidade','municipio','praca'],
  topologia: ['topologia','tecnologia','rede','tipo de rede'],
  nome: ['nome','responsavel','colaborador','contato','nome completo'],
  cargo: ['cargo','funcao','atividade','posicao'],
  nivel: ['nivel','ordem','etapa','grau'],
  telefone: ['telefone','celular','whatsapp','fone','numero','tel'],
  observacoes: ['observacoes','observacao','comentarios','obs','nota'],
  abrangencia: ['abrangencia','escopo','cobertura','aplicacao'],
  inicio: ['inicio vigencia','data inicio','vigencia inicial'],
  fim: ['fim vigencia','data fim','vigencia final']
};
export function fieldForHeader(text) {
  const key = normalizeText(text);
  return Object.keys(FIELD_ALIASES).find(field => FIELD_ALIASES[field].includes(key)) || '';
}
export function resolveCluster(input) {
  const value = normalizeText(input).toUpperCase();
  if (CLUSTERS.includes(value)) return value;
  const known = {
    'RIO DE JANEIRO':'RJ', 'ESPIRITO SANTO':'ES', 'MINAS GERAIS':'MG',
    'CENTRO OESTE':'CO', 'CENTRO-OESTE':'CO', 'NORDESTE':'NE',
    'NORTE':'NO', 'BAHIA':'BA', 'BAHIA SERGIPE':'BA', 'BAHIA E SERGIPE':'BA', 'BA/SE':'BA'
  };
  if (known[value]) return known[value];
  // Nomes de abas: "RJ - Escalonamento", "Contatos (RJ)".
  const tokens = value.match(/(?:^|[^A-Z])(RJ|ES|MG|CO|NE|NO|BA)(?=$|[^A-Z])/g) || [];
  const clusters = [...new Set(tokens.map(token => token.match(/(RJ|ES|MG|CO|NE|NO|BA)/)?.[0]).filter(Boolean))];
  return clusters.length === 1 ? clusters[0] : '';
}
export function normalizePhone(raw) {
  const original = String(raw ?? '').trim();
  let digits = original.replace(/\D/g,'');
  if (!digits) return {valid:false, error:'Telefone ausente', display:original, e164:''};
  // 12/13 dígitos contendo 55 inicial: DDI + DDD + número. 10/11: DDD nacional (inclusive DDD 55).
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (!(digits.length === 10 || digits.length === 11)) {
    return {valid:false,error:'Telefone deve ter DDD e 8 ou 9 dígitos',display:original,e164:''};
  }
  const ddd = digits.slice(0,2);
  const subscriber = digits.slice(2);
  if (!/^[1-9][1-9]$/.test(ddd) || !/^[2-9]\d{7}$/.test(subscriber) && !/^9\d{8}$/.test(subscriber)) {
    return {valid:false,error:'DDD ou número inválido',display:original,e164:''};
  }
  const display = digits.length === 11
    ? '('+ddd+') '+subscriber.slice(0,5)+'-'+subscriber.slice(5)
    : '('+ddd+') '+subscriber.slice(0,4)+'-'+subscriber.slice(4);
  return {valid:true,error:'',display,e164:'55'+digits};
}
export const whatsappUrl = (contact) => {
  const result = normalizePhone(contact.phone_e164 || contact.telefone || '');
  return result.valid ? 'https://wa.me/'+result.e164 : '';
};
export function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/,'');
  const first = input.split(/\r?\n/,1)[0] || '';
  const delimiters = [';',',','\t'];
  const counts = delimiters.map(d => (first.match(new RegExp(d === '\t' ? '\t' : '\\'+d,'g')) || []).length);
  const delimiter = delimiters[counts.indexOf(Math.max(...counts))] || ';';
  const rows=[]; let row=[]; let cell=''; let inside=false;
  for (let i=0;i<input.length;i++) {
    const ch=input[i];
    if (ch==='"') {
      if (inside && input[i+1]==='"') {cell+='"';i++;}
      else inside=!inside;
    } else if (ch===delimiter && !inside) {row.push(cell.trim());cell='';}
    else if ((ch==='\n'||ch==='\r')&&!inside) {
      if(ch==='\r'&&input[i+1]==='\n') i++;
      row.push(cell.trim()); if(row.some(Boolean)) rows.push(row);
      row=[];cell='';
    } else cell+=ch;
  }
  if(inside)throw new Error('CSV inválido: campo com aspas não encerradas');
  row.push(cell.trim());if(row.some(Boolean)) rows.push(row);
  return rows;
}
function parseImportDate(value) {
 const v=String(value||'').trim();
 if(!v)return null;
 let iso=v;
 const br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(br)iso=br[3]+'-'+br[2]+'-'+br[1];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
 const d=new Date(iso+'T00:00:00Z');
 return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso?'':iso;
}

export function parseTables(tables) {
  const valid=[];const errors=[];
  for (const table of tables) {
    const matrix=table.rows || [];
    let best={index:-1,score:-1,headers:[]};
    matrix.slice(0,25).forEach((cells,index)=>{
      const headers=cells.map(fieldForHeader);
      const score=new Set(headers.filter(Boolean)).size+(headers.includes('nome')?3:0)+(headers.includes('telefone')?3:0);
      if(score>best.score) best={index,score,headers};
    });
    if(best.index<0||!best.headers.includes('nome')||!best.headers.includes('telefone')){
      errors.push({sheet:table.sheet,row:0,message:'Cabeçalhos Nome e Telefone não encontrados'});
      continue;
    }
    const fromSheet=resolveCluster(table.sheet);
    for(let i=best.index+1;i<matrix.length;i++){
      const cells=matrix[i] || [];
      if(!cells.some(cell=>String(cell??'').trim())) continue;
      const entry={};
      best.headers.forEach((field,col)=>{if(field) entry[field]=String(cells[col]??'').trim();});
      if(!entry.nome && !entry.telefone) continue; // rodapé ou linhas vazias
      const explicit=entry.cluster ? resolveCluster(entry.cluster) : fromSheet;
      const phone=normalizePhone(entry.telefone);
      const rowErrors=[];
      if(!explicit) rowErrors.push('Cluster ausente ou ambíguo');
      if(!entry.nome) rowErrors.push('Nome obrigatório');
      if(!phone.valid) rowErrors.push(phone.error);
      const start=parseImportDate(entry.inicio);
      const end=parseImportDate(entry.fim);
      if(start===''||end==='')rowErrors.push('Data de vigência inválida');
      if(start&&end&&start>end)rowErrors.push('Vigência inicial posterior à final');
      if(rowErrors.length){
        errors.push({sheet:table.sheet,row:i+1,message:rowErrors.join('; ')});
        continue;
      }
      valid.push({
        cluster:explicit, area:entry.area || '', cidade:entry.cidade || '',
        topologia:entry.topologia || '', full_name:entry.nome, cargo:entry.cargo || '',
        nivel:entry.nivel || '', phone_e164:phone.e164, phone_display:phone.display,
        notes:entry.observacoes || '',
        scope:normalizeText(entry.abrangencia).includes('regional') || !entry.cidade ? 'regional' : 'local',
        valid_from:start,valid_until:end,active:true
      });
    }
  }
  return {valid,errors};
}
export function contactKey(contact){
  return [contact.cluster,contact.area,contact.cidade,contact.topologia,contact.full_name,contact.cargo,contact.nivel,contact.source_occurrence??1]
    .map(normalizeText).join('|');
}
export function sameContactData(a,b) {
  return ['cluster','area','cidade','topologia','full_name','cargo','nivel','phone_e164','notes','scope','valid_from','valid_until','active']
    .every(field=>String(a[field]??'')===String(b[field]??''));
}
export function importPreview(existing,incoming,mode='merge') {
  const old = new Map(existing.map(c=>[contactKey(c),c]));
  const incomingMap = new Map(incoming.map(c=>[contactKey(c),c]));
  const clusters=[...new Set(incoming.map(c=>c.cluster))];
  let added=0,changed=0,unchanged=0,removed=0;
  incomingMap.forEach((c,key)=>{
    if(!old.has(key)) added++;
    else if(sameContactData(old.get(key),c)) unchanged++;
    else changed++;
  });
  if(mode==='replace_clusters'){
    existing.forEach(c=>{if(clusters.includes(c.cluster) && !incomingMap.has(contactKey(c))) removed++;});
  }
  return {added,changed,unchanged,removed,clusters,duplicates:incoming.length-incomingMap.size};
}
export function topologyValues(value){
  const v=normalizeText(value),tokens=[];
  for(const [label,re] of [['GPON',/\bgpon\b/],['HFC',/\bhfc\b/],['FIBRA',/\b(fibra|fo)\b/],['COAXIAL',/\bcoaxial\b/],['EMPRESARIAL',/\b(empresarial|emp)\b/],['BKB',/\bbkb\b/]])if(re.test(v))tokens.push(label);
  return tokens.length?tokens:String(value||'').trim()?[String(value).trim()]:[];
}
export function filterContacts(contacts, filters={}) {
  const search=normalizeText(filters.query);
  const activeOnly=filters.includeInactive !== true;
  const cityAreas=new Set(contacts.filter(c=>(!filters.cluster||c.cluster===filters.cluster)&&normalizeText(c.cidade)===normalizeText(filters.cidade)).map(c=>c.cluster+'|'+normalizeText(c.area)));
  const filtered=contacts.filter(c=>{
    if(activeOnly && c.active===false) return false;
    if(filters.cluster && c.cluster!==filters.cluster) return false;
    if(filters.area && c.area && normalizeText(c.area)!==normalizeText(filters.area)) return false;
    if(filters.cidade && c.scope!=='regional' && c.cidade && normalizeText(c.cidade)!==normalizeText(filters.cidade)) return false;
    if(filters.cidade && c.scope==='regional' && c.area && !cityAreas.has(c.cluster+'|'+normalizeText(c.area)))return false;
    if(filters.topologia && c.topologia && !topologyValues(c.topologia).some(v=>normalizeText(v)===normalizeText(filters.topologia)) && normalizeText(c.topologia)!==normalizeText(filters.topologia)) return false;
    if(filters.cargo && c.cargo && normalizeText(c.cargo)!==normalizeText(filters.cargo)) return false;
    if(filters.nivel && normalizeText(c.nivel)!==normalizeText(filters.nivel)) return false;
    if(search && !normalizeText([c.cluster,c.area,c.cidade,c.topologia,c.full_name,c.cargo,c.nivel,c.notes].join(' ')).includes(search)) return false;
    return true;
  });
  return filtered.sort((a,b)=>{
    const rank=c=>{const m=String(c.nivel||'').match(/\d+/);return m?Number(m[0]):999;};
    return rank(a)-rank(b)||a.full_name.localeCompare(b.full_name,'pt-BR');
  });
}
export function isCurrentValidity(c,date=new Date()){
  const today=date.toISOString().slice(0,10);
  return (!c.valid_from||today>=c.valid_from)&&(!c.valid_until||today<=c.valid_until);
}
// A consulta operacional só exibe contatos após escolher uma região.
// O diretório completo continua usando filterContacts sem esta restrição de navegação.
export function consultationContacts(contacts,filters={}){
  return CLUSTERS.includes(filters.cluster)?filterContacts(contacts,filters):[];
}
