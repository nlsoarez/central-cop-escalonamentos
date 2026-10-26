import {normalizePhone} from './core.mjs';
export const dialUrl = contact => {
 const phone=normalizePhone(contact.phone_e164||contact.phone_display||'');
 return phone.valid?'tel:+'+phone.e164:'';
};
export const operationalNotes = notes => String(notes||'').split(/\r?\n/)
 .filter(line=>!/^\s*(origem|linha de origem|abrang[eê]ncia original|mercado\s*\/\s*[aá]rea original|[aá]rea original)\s*:/i.test(line))
 .filter(line=>!/^\s*abrang[eê]ncia regional\s*$/i.test(line)).join('\n').trim();
export function contactShareText(contact){
 const phone=normalizePhone(contact.phone_e164||contact.phone_display||'');
 const fields=[['Nome',contact.full_name],['Cargo',contact.cargo],['Nível',contact.nivel],['Região',contact.cluster],['Área',contact.area],['Localidade',contact.cidade],['Topologia',contact.topologia],['Telefone',phone.valid?phone.display:'']];
 return 'CENTRAL COP — ESCALONAMENTOS\n\n'+fields.filter(([,value])=>String(value||'').trim()).map(([label,value])=>label+': '+String(value).trim()).join('\n');
}
const escapeVCard = value => String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line){
 const encoder=new TextEncoder();let out='',bytes=0;
 for(const char of line){const length=encoder.encode(char).length;if(bytes+length>75){out+='\r\n ';bytes=1;}out+=char;bytes+=length;}
 return out;
}
export function contactVCard(contact){
 const phone=normalizePhone(contact.phone_e164||contact.phone_display||'');
 const note=[['Nível',contact.nivel],['Região',contact.cluster],['Área',contact.area],['Localidade',contact.cidade],['Topologia',contact.topologia]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join('\n');
 return ['BEGIN:VCARD','VERSION:3.0','FN:'+escapeVCard(contact.full_name),'N:;'+escapeVCard(contact.full_name)+';;;',...(contact.cargo?['TITLE:'+escapeVCard(contact.cargo)]:[]),...(phone.valid?['TEL;TYPE=VOICE:+'+phone.e164]:[]),...(note?['NOTE:'+escapeVCard(note)]:[]),'END:VCARD'].map(fold).join('\r\n')+'\r\n';
}
export async function shareContact(contact,{nav=globalThis.navigator,copy}={}){
 const text=contactShareText(contact);
 if(typeof nav?.share==='function'){
  // File capability checks do not guarantee that Android will accept a vCard.
  // Open the native text sheet directly in this user gesture, without a file probe.
  try{await nav.share({title:'Central COP — Escalonamentos',text});return {kind:'text'};}
  catch(error){
   if(error?.name==='AbortError')return {kind:'cancelled'};
   // A rejected native share may consume user activation. Retry only on a fresh click.
   return {kind:'copy-required'};
  }
 }
 if(!copy)throw Error('Compartilhamento indisponível neste navegador.');
 await copy(text);return {kind:'copied'};
}
