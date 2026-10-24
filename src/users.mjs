// Regras de matrícula e importação de nomes (sem dados pessoais embutidos).
import {parseCsv} from './core.mjs';
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
  const source=String(text||'').replace(/^\uFEFF/,'');
  const markdown=source.trimStart().startsWith('|');
  let lines;
  try{lines=markdown?source.split(/\r?\n/):parseCsv(source);}
  catch{ return {data:[],errors:[{line:1,message:'CSV inválido: confira as aspas e colunas LOGIN e NOME'}]}; }
  for(let index=0; index<lines.length; index++){
    const line=Array.isArray(lines[index])?'':lines[index].trim();
    if(Array.isArray(lines[index])&&String(lines[index][0]||'').startsWith('#'))continue;
    if(!Array.isArray(lines[index])&&(!line || /^#/.test(line)))continue;
    let cells;
    if(Array.isArray(lines[index]))cells=lines[index];
    else if(line.startsWith('|')) cells=line.replace(/^\|/,'').replace(/\|$/,'').split('|').map(v=>v.trim());
    else if(line.includes('\t'))cells=line.split('\t').map(v=>v.trim());
    else if(line.includes(';'))cells=line.split(';').map(v=>v.trim());
    else if(line.includes(','))cells=line.split(',').map(v=>v.trim());
    else {errors.push({line:index+1,message:'Colunas LOGIN e NOME não identificadas'});continue;}
    if(cells.every(c=>/^-{3,}$/.test(c.replace(/\s/g,''))))continue;
    if(isHeader(cells))continue;
    if(cells.length!==2){errors.push({line:index+1,message:'São necessárias exatamente duas colunas: LOGIN e NOME'});continue;}
    const login=normalizeLogin(cells[0]);
    const nome=normalizeDisplayName(cells[1]);
    if(!LOGIN_PATTERN.test(login)){errors.push({line:index+1,message:'Matrícula inválida'});continue;}
    if(nome.length<3||nome.length>120){errors.push({line:index+1,message:'Nome deve ter entre 3 e 120 caracteres'});continue;}
    if(seen.has(login)){errors.push({line:index+1,message:'Matrícula repetida: '+login});continue;}
    seen.add(login);data.push({login,nome});
  }
  return {data,errors};
}
