// Regras de matrícula e importação de nomes (sem dados pessoais embutidos).
export const LOGIN_PATTERN = /^[A-Z][A-Z0-9]{4,14}$/;
export function normalizeLogin(input) {
  return String(input ?? '').trim().toUpperCase();
}
export function accountAlias(login) {
  const normalized = normalizeLogin(login);
  if (!LOGIN_PATTERN.test(normalized)) throw new Error('Matrícula inválida');
  // Alias interno de autenticação, não é um endereço para receber e-mails.
  return normalized.toLowerCase() + '@users.central-cop.invalid';
}
export function normalizeDisplayName(input) {
  return String(input ?? '').trim().replace(/\s+/g, ' ');
}
function isHeader(cells) {
  const h = cells.map(v=>v.toUpperCase().trim());
  return h.includes('LOGIN') && h.includes('NOME');
}
export function parseRoster(text) {
  const data=[];
  const errors=[];
  const seen=new Set();
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/);
  for(let index=0; index<lines.length; index++){
    const line=lines[index].trim();
    if(!line || /^#/.test(line))continue;
    let cells;
    if(line.startsWith('|')) cells=line.replace(/^\|/,'').replace(/\|$/,'').split('|').map(v=>v.trim());
    else if(line.includes('\t'))cells=line.split('\t').map(v=>v.trim());
    else if(line.includes(';'))cells=line.split(';').map(v=>v.trim());
    else if(line.includes(','))cells=line.split(',').map(v=>v.trim());
    else {errors.push({line:index+1,message:'Colunas LOGIN e NOME não identificadas'});continue;}
    if(cells.every(c=>/^-{3,}$/.test(c.replace(/\s/g,''))))continue;
    if(isHeader(cells))continue;
    const login=normalizeLogin(cells[0]);
    const nome=normalizeDisplayName(cells[1]);
    if(!LOGIN_PATTERN.test(login)){errors.push({line:index+1,message:'Matrícula inválida'});continue;}
    if(nome.length<3||nome.length>120){errors.push({line:index+1,message:'Nome deve ter entre 3 e 120 caracteres'});continue;}
    if(seen.has(login)){errors.push({line:index+1,message:'Matrícula repetida: '+login});continue;}
    seen.add(login);data.push({login,nome});
  }
  return {data,errors};
}
