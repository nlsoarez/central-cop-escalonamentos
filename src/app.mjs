import {CLUSTERS,normalizeText,normalizePhone,whatsappUrl,parseCsv,filterContacts,importPreview,isCurrentValidity,topologyValues,consultationContacts} from './core.mjs';
import {parseWorkbook} from './workbook.mjs';
import {store} from './store.mjs';
import {parseRoster,normalizeLogin} from './users.mjs';
import {reportDialog,reviewDialog,reportsPage} from './contact-reports.mjs';
import {dialUrl,operationalNotes,shareContact,contactShareText} from './contact-actions.mjs';
import {createSessionRecovery} from './session-lifecycle.mjs';
import {setupPwa} from './pwa.mjs';
import {regionMap} from './region-maps.mjs';

const root=document.getElementById('app');
const initialSetupToken=new URLSearchParams(location.hash.slice(1)).get('setup')||'';
if(initialSetupToken)history.replaceState(null,'',location.pathname+location.search);
const DEMO_BANNER='Demonstração com contatos fictícios. Não utilize para acionamentos.';
const iconPaths={
 whatsapp:'<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-4.2A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8 7.5h1.5l1 2-1 1a8 8 0 0 0 3 3l1-1 2 1V15c0 .8-.8 1.2-1.6 1A11.7 11.7 0 0 1 7 9.1c-.2-.8.2-1.6 1-1.6Z"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
 share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 layout:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 9h12"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 star:'<path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.7 19.7 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.77.64 2.6a2 2 0 0 1-.45 2.12L8.09 9.64a16 16 0 0 0 6.27 6.27l1.2-1.2a2 2 0 0 1 2.12-.45c.83.3 1.7.52 2.6.64A2 2 0 0 1 22 16.92Z"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8v.1"/>',
 refresh:'<path d="M3 11a9 9 0 0 1 15-6l3 3M21 13a9 9 0 0 1-15 6l-3-3"/><path d="M21 3v5h-5M3 21v-5h5"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 edit:'<path d="m4 20 4-.9L20 7a2 2 0 0 0-3-3L5 16z"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 alert:'<path d="M12 3 2 21h20zM12 9v5m0 3v.1"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 bolt:'<path d="m13 2-9 11h7l-1 9 10-12h-7z"/>'
};
const ic=(name,size=18)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.info)+'</svg>';
const brandIcon=(size=42)=>'<img class="brand-icon" src="/assets/icon-192.png?v=headset-transparent" alt="" width="'+size+'" height="'+size+'" />';
const h=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const userIsAdmin=()=>state.user?.active&&!state.user?.must_change_password&&state.user?.role==='admin';
const storage=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const setStorage=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));}catch{}};
const state={setupToken:initialSetupToken,pendingRoster:[],user:null,loading:true,contacts:[],view:'consultar',filters:{cluster:'',area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:''},favorites:[],recent:[],upload:null,importMode:'merge',batches:[],accounts:[],roster:null,rosterRaw:'',credentials:[],modal:null,notice:'',busy:false};
state.connection=navigator.onLine===false?'unavailable':'online';
state.shareMode='auto';state.sharePending=false;state.reports=[];state.reportsLoading=false;state.reportsError='';state.reportFilter='open';state.reportDraft=null;state.reviewDraft=null;state.reportPending=false;state.modalReturn=null;
const mobile=()=>matchMedia('(max-width: 760px)').matches;
const toast=(message,kind='info')=>{
 state.notice={message,kind};
 root.querySelectorAll('.toast').forEach(el=>el.remove());
 root.insertAdjacentHTML('beforeend','<div class="toast '+h(kind)+'" role="status">'+h(message)+'</div>');
 setTimeout(()=>{if(state.notice?.message===message){state.notice='';root.querySelectorAll('.toast').forEach(el=>el.remove());}},4500);
};
function navButton(page,title,iconName){
  return '<button type="button" class="nav-link '+(state.view===page?'active':'')+'" '+(state.view===page?'aria-current="page"':'')+' data-action="nav" data-page="'+page+'">'+ic(iconName)+'<span>'+title+'</span></button>';
}
function topTitle(){
  return ({consultar:'Consulta de escalonamentos',diretorio:'Diretório de contatos',favoritos:'Meus favoritos',recentes:'Consultas recentes',administracao:'Administração',importar:'Importação de planilhas',usuarios:'Gestão de usuários',alteracoes:'Atualizações de contatos'})[state.view]||'Central COP';
}
function uiHeader(){
 const stamp=state.contacts.map(c=>c.updated_at||'').filter(Boolean).sort().at(-1);
 const date=stamp?new Date(stamp).toLocaleString('pt-BR'):'Ainda sem atualização';
 const records=state.contacts.filter(c=>c.active!==false).length.toLocaleString('pt-BR');
 return '<header class="topbar"><div class="brand-mini">'+brandIcon(28)+'<strong>Central COP</strong><span>/ Operação de rede</span></div><div class="top-actions"><span class="status-pill '+(store.demo?'demo':'live')+'"><i></i>'+(store.demo?'Demonstração':'Base conectada')+'</span><div class="avatar" title="'+h(state.user?.email||'Modo demonstração')+'">'+h((state.user?.display_name||'COP').slice(0,2).toUpperCase())+'</div><span class="user-name">'+h(state.user?.display_name||'Demonstração')+'</span>'+(store.configured?'<button class="btn subtle account-password" data-action="change-password">Alterar senha</button><button class="icon-btn" data-action="logout" title="Sair" aria-label="Sair da conta">'+ic('logout')+'</button>':'')+'</div></header>'+
 '<section class="hero"><div class="hero-copy"><div class="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>Central COP</h1><div class="hero-subtitle">ESCALONAMENTOS</div><p>Gestão e consulta de escalonamentos operacionais.</p><span class="hero-data">'+ic('clock',13)+' Atualização: '+h(date)+'</span></div><div class="hero-summary" aria-label="Resumo do diretório"><div><span>Regiões atendidas</span><strong>'+String(CLUSTERS.length).padStart(2,'0')+'</strong></div><div><span>Registros na base</span><strong>'+records+'</strong></div></div></section>';
}
function themeButton(){
 const dark=document.documentElement.dataset.theme==='dark';
 return '<button type="button" class="nav-link theme-toggle" data-action="theme" aria-pressed="'+dark+'" title="'+(dark?'Ativar tema claro':'Ativar tema escuro')+'">'+ic(dark?'settings':'moon')+'<span>Tema '+(dark?'claro':'escuro')+'</span></button>';
}
function renderShell(){
 const nav=navButton('consultar','Consultar','search')+navButton('diretorio','Diretório de contatos','users')+navButton('favoritos','Favoritos','star')+navButton('recentes','Recentes','clock')+navButton('alteracoes','Atualizações','edit')+
 '<div class="nav-divider"></div>'+themeButton()+
 (userIsAdmin()?'<div class="nav-divider"></div>'+navButton('administracao','Administração','settings')+navButton('importar','Importar planilha','upload')+navButton('usuarios','Usuários e senhas','users'):'');
 return '<div class="layout"><aside class="sidebar"><div class="sidebar-brand"><div class="logo">'+brandIcon(48)+'</div><div><strong>Central COP</strong><small>OPERAÇÃO DE REDE</small></div></div><div class="nav-caption">NAVEGAÇÃO</div><nav aria-label="Menu principal">'+nav+'<button class="nav-link mobile-only" data-action="mobile-menu" aria-expanded="'+Boolean(state.mobileMenu)+'">'+ic('settings')+'<span>Mais</span></button></nav><div class="sidebar-foot">'+ic('info')+'<span>Ambiente interno<small>Central de Operações</small></span></div></aside><div class="main-area">'+uiHeader()+'<main class="content">'+(store.demo?'<div class="demo-banner">'+ic('alert')+' '+DEMO_BANNER+'</div>':'')+'<div class="section-top"><div><p class="overline">CENTRAL DE CONSULTA</p><h2>'+h(topTitle())+'</h2></div><span class="muted-caption">'+state.contacts.filter(c=>c.active!==false).length+' contato(s) ativo(s)</span></div>'+renderPage()+'</main></div></div>'+
 (state.mobileMenu?'<section class="mobile-more mobile-only" aria-label="Mais opções">'+themeButton()+navButton('alteracoes','Atualizações','edit')+(userIsAdmin()?navButton('administracao','Administração','settings')+navButton('importar','Importar planilha','upload')+navButton('usuarios','Usuários e senhas','users'):'')+(store.configured?'<button class="btn subtle" data-action="change-password">Alterar senha</button>':'')+'<button class="btn subtle" data-action="mobile-menu">Fechar menu</button></section>':'')+
 (state.notice?'<div class="toast '+h(state.notice.kind)+'" role="status">'+h(state.notice.message)+'</div>':'')+(state.modal?renderModal():'');
}
function clusterBar(){
 const labels={RJ:'Rio de Janeiro',ES:'Espírito Santo',MG:'Minas Gerais',CO:'Centro-Oeste',NE:'Nordeste',NO:'Norte',BA:'Bahia / Sergipe'};
 return '<div class="clusters" aria-label="Regiões">'+CLUSTERS.map(c=>'<button type="button" data-action="cluster" data-cluster="'+c+'" aria-pressed="'+(state.filters.cluster===c)+'" aria-expanded="'+(state.filters.cluster===c)+'" aria-controls="region-subgroups" class="cluster '+(state.filters.cluster===c?'selected':'')+'"><span class="cluster-symbol">'+regionMap(c)+'</span><span class="cluster-label"><strong>'+c+'</strong><small>'+labels[c]+'</small></span><span class="cluster-check">'+ic(state.filters.cluster===c?'check':'chevron',13)+'</span></button>').join('')+'</div>';
}
function optionList(key,label) {
 const candidates=state.contacts.filter(c=>c.cluster===state.filters.cluster&&c.active!==false&&(!state.filters.area||!c.area||normalizeText(c.area)===normalizeText(state.filters.area)));
 const vals=[...new Set(candidates.flatMap(c=>key==='topologia'?topologyValues(c[key]):[c[key]]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const current=state.filters[key]||'';
 const options='<option value="">Todos</option>'+vals.map(v=>'<option value="'+h(v)+'" '+(current===v?'selected':'')+'>'+h(v)+'</option>').join('');
 return '<label class="field"><span>'+label+'</span><select data-filter="'+key+'">'+options+'</select></label>';
}
function subgroupBar(){
 if(!state.filters.cluster)return '<section id="region-subgroups" hidden></section>';
 const areas=[...new Set(state.contacts.filter(c=>c.cluster===state.filters.cluster&&c.active!==false).map(c=>c.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const button=(area,label)=>'<button type="button" data-action="subgroup" data-area="'+h(area)+'" aria-pressed="'+(state.filters.area===area)+'" class="subgroup-button '+(state.filters.area===area?'selected':'')+(!area?' all':'')+'"><span class="subgroup-mark">'+ic(state.filters.area===area?'check':'map',15)+'</span><span>'+h(label)+'</span>'+ic('chevron',13)+'</button>';
 return '<section id="region-subgroups" class="region-subgroups" aria-label="Subgrupos da região '+h(state.filters.cluster)+'"><div class="subgroup-heading"><strong>Subgrupos de '+h(state.filters.cluster)+'</strong><span>Selecione uma área para refinar a consulta.</span></div>'+(areas.length?'<div class="subgroup-options" role="group" aria-label="Selecionar subgrupo">'+button('','Todos os subgrupos')+areas.map(a=>button(a,a)).join('')+'</div>':'<p class="panel-hint">Não há subgrupos cadastrados nesta região.</p>')+'</section>';
}
function filterUI(){
 const selected=Boolean(state.filters.cluster);
 const search=selected?'<div class="refine-search"><form id="searchForm" class="search-row"><label class="search-wrap">'+ic('search',20)+'<input id="mainSearch" name="query" type="search" autocomplete="off" placeholder="Buscar nome, cidade, cargo ou topologia" value="'+h(state.filters.query)+'" aria-label="Pesquisar contatos"/></label><button type="submit" class="btn primary">'+ic('search',18)+' Buscar</button></form><div class="filter-grid subgroup-filters">'+optionList('cidade','Cidade / Localidade')+optionList('topologia','Topologia')+optionList('cargo','Cargo')+optionList('nivel','Nível')+'<button type="button" class="btn clear-btn" data-action="clear">'+ic('refresh',15)+' Limpar filtros</button></div></div>':'';
 return '<section class="filter-card"><div class="filter-intro"><div><h3>Região de atendimento</h3><p>Selecione uma região para encontrar os responsáveis.</p></div><span class="selection-hint">'+(selected?h(state.filters.cluster)+' selecionada':'Nenhuma selecionada')+'</span></div>'+clusterBar()+subgroupBar()+search+'</section>';
}
function contactCard(c){
 const validNumber=normalizePhone(c.phone_e164||c.phone_display||'');
 const url=whatsappUrl(c),dial=dialUrl(c),isFav=state.favorites.includes(c.id);
 const enabled=!store.demo&&validNumber.valid;
 const phone=enabled
  ? '<a class="phone-link desktop-only" href="'+url+'" target="_blank" rel="noopener noreferrer" data-contact="'+h(c.id)+'">'+ic('phone',16)+' '+h(validNumber.display)+'</a><a class="phone-dial mobile-only" href="'+dial+'" aria-label="Ligar para '+h(c.full_name)+'">'+ic('phone',18)+' '+h(validNumber.display)+'</a>'
  : '<span class="phone-disabled" title="'+(store.demo?'Demonstração: chamadas desativadas':'Telefone inválido')+'">'+ic('phone',16)+' '+h(c.phone_display||'Sem telefone válido')+'</span>';
 const valid=isCurrentValidity(c),notes=operationalNotes(c.notes);
 const place=[c.cluster,c.area,c.cidade].filter(Boolean).join(' · ');
 return '<article class="contact-card"><div class="level-block level-'+h(String(c.nivel||'other').match(/\d/)?.[0]||'other')+'"><strong>'+(c.nivel?'Nível '+h(c.nivel):'Sem nível')+'</strong></div>'+
  '<div class="contact-person"><div class="person-avatar">'+ic('users',22)+'</div><div class="person-details"><h3>'+h(c.full_name)+'</h3>'+(c.cargo?'<div class="role">'+h(c.cargo)+'</div>':'')+(place?'<div class="dim">'+h(place)+'</div>':'')+'<div class="tags">'+(c.topologia?'<span class="tag">'+h(c.topologia)+'</span>':'')+(!valid?'<span class="tag warn">Fora da vigência informada</span>':'')+(c.active===false?'<span class="tag warn">Inativo</span>':'')+'</div></div></div>'+
  '<div class="contact-meta">'+phone+(notes?'<div class="notes">'+ic('info',14)+' '+h(notes)+'</div>':'')+'</div>'+
  '<div class="contact-actions"><div class="mobile-primary-actions mobile-only">'+(enabled?'<a class="btn primary dial-action" href="'+dial+'">'+ic('phone',21)+'<span>Ligar</span></a>':'<button class="btn primary dial-action" disabled>'+ic('phone',21)+'<span>Ligar</span></button>')+'<button class="btn whatsapp" '+(!enabled?'disabled':'data-action="whatsapp" data-id="'+h(c.id)+'"')+'>'+ic('whatsapp',22)+'<span>WhatsApp</span></button></div>'+
  '<button class="btn whatsapp desktop-only" '+(!enabled?'disabled title="Telefone inválido ou demonstração"':'data-action="whatsapp" data-id="'+h(c.id)+'"')+'>'+ic('phone',16)+' WhatsApp</button>'+
  '<button class="btn subtle share-action mobile-only" data-action="share" data-id="'+h(c.id)+'" '+(store.demo||state.sharePending?'disabled':'')+'>'+ic('share',17)+' '+(state.shareMode==='copy'?'Copiar informações':typeof navigator.share==='function'?'Compartilhar':'Compartilhar / copiar')+'</button>'+
  '<button class="btn subtle desktop-only" data-action="copy" data-id="'+h(c.id)+'">'+ic('copy',15)+' Copiar</button>'+
  '<button class="btn max desktop-only" disabled title="Integração NICE MAX pendente de homologação">'+ic('phone',15)+' MAX</button>'+
  '<button class="icon-btn favorite '+(isFav?'selected':'')+'" data-action="favorite" data-id="'+h(c.id)+'" aria-pressed="'+isFav+'" title="'+(isFav?'Remover favorito':'Adicionar favorito')+'">'+ic('star',19)+'</button>'+
  '<button class="btn subtle report-contact '+(userIsAdmin()?'':'wide')+'" data-action="report" data-id="'+h(c.id)+'" '+(store.demo?'disabled':'')+'>'+ic('edit',15)+' Informar alteração</button>'+
  (userIsAdmin()?'<button class="icon-btn edit-contact" data-action="edit" data-id="'+h(c.id)+'" title="Editar contato">'+ic('edit')+'</button>':'')+'</div></article>';
}
function contactList(list){
 if(!list.length)return '<div class="empty"><div class="empty-icon">'+ic('search',32)+'</div><h3>Nenhum contato encontrado</h3><p>Revise os filtros ou confirme se há contatos cadastrados nessa região.</p><button class="btn subtle" data-action="clear">Limpar filtros</button></div>';
 return '<div class="result-caption"><strong>'+list.length+' contato(s) encontrado(s)</strong><span>Ordenados por nível de escalonamento</span></div><div class="contacts">'+list.map(contactCard).join('')+'</div>';
}
function rightPanel(){
 const fav=state.favorites.map(id=>state.contacts.find(c=>c.id===id)).filter(Boolean).slice(0,4);
 const recent=state.recent.slice(0,5);
 return '<aside class="side-panels"><section class="panel"><h3>'+ic('bolt')+' Acesso rápido</h3><div class="quick-grid"><button data-action="quick" data-mode="city">'+ic('map')+' Localidades</button><button data-action="quick" data-mode="topology">'+ic('layout')+' Topologias</button><button data-action="nav" data-page="diretorio">'+ic('users')+' Diretório</button><button data-action="nav" data-page="favoritos">'+ic('star')+' Favoritos</button></div></section><section class="panel"><h3>'+ic('star')+' Favoritos <button data-action="nav" data-page="favoritos">Ver todos</button></h3>'+(fav.length?fav.map(c=>'<div class="mini-row"><span class="mini-avatar">'+ic('users',16)+'</span><div><strong>'+h(c.full_name)+'</strong><small>'+h(c.cluster)+' · '+h(c.cidade||'Regional')+'</small></div><button data-action="jump" data-id="'+h(c.id)+'" title="Localizar">'+ic('chevron')+'</button></div>').join(''):'<p class="panel-hint">Marque a estrela de um contato para acessá-lo rapidamente.</p>')+'</section><section class="panel"><h3>'+ic('clock')+' Recentes</h3>'+(recent.length?recent.map(item=>'<div class="mini-row"><span class="mini-avatar">'+ic('search',16)+'</span><div><strong>'+h(item.label)+'</strong><small>'+h(item.time)+'</small></div><button data-action="recent" data-query="'+h(item.query)+'" data-cluster="'+h(item.cluster||'')+'" title="Pesquisar novamente">'+ic('chevron')+'</button></div>').join(''):'<p class="panel-hint">Suas pesquisas aparecerão aqui.</p>')+'</section></aside>';
}
function consultation(){
 const selected=Boolean(state.filters.cluster);
 const visible=consultationContacts(state.contacts,state.filters);
 const results=selected?'<div class="results-heading"><div>'+ic('map',20)+'<h3>Escalonamento — '+h(state.filters.cluster)+(state.filters.area?' / '+h(state.filters.area):'')+'</h3></div><span>Localidade: '+h(state.filters.cidade||'Todas')+'</span></div>'+contactList(visible):'<section class="empty region-prompt" aria-live="polite">'+ic('map',32)+'<h3>Selecione uma região para começar</h3><p>Os subgrupos e os contatos aparecerão após a seleção.</p></section>';
 return '<div class="workspace '+(!selected?'consultation-idle':'')+'"><div class="primary-column">'+filterUI()+results+'</div>'+(selected?rightPanel():'')+'</div>';
}
function directory(){
 const visible=filterContacts(state.contacts,{...state.filters,cluster:'',area:'',cidade:'',nivel:'',cargo:'',topologia:'',includeInactive:userIsAdmin()});
 return '<div class="standalone"><div class="toolbar"><form id="directoryForm" class="toolbar-search">'+ic('search')+'<input name="query" type="search" id="directorySearch" placeholder="Buscar em todo o diretório" value="'+h(state.filters.query)+'"/><button class="icon-btn" type="submit" title="Buscar">'+ic('search')+'</button></form><span class="pill">'+visible.length+' registros</span>'+(userIsAdmin()?'<button class="btn primary" data-action="new">'+ic('edit')+' Novo contato</button>':'')+'</div>'+contactList(visible)+'</div>';
}
function favoritesPage(){const list=state.favorites.map(id=>state.contacts.find(c=>c.id===id)).filter(Boolean);return '<div class="standalone"><p class="section-description">Seus contatos favoritos são armazenados somente neste navegador.</p>'+contactList(list)+'</div>';}
function recentPage(){return '<div class="standalone"><p class="section-description">Pesquisas recentes salvas somente neste dispositivo.</p><div class="panel">'+(state.recent.length?state.recent.map(item=>'<button class="recent-item" data-action="recent" data-query="'+h(item.query)+'" data-cluster="'+h(item.cluster)+'">'+ic('clock')+'<span><strong>'+h(item.label)+'</strong><small>'+h(item.time)+'</small></span>'+ic('chevron')+'</button>').join(''):'<p class="panel-hint">Ainda não há consultas recentes.</p>')+'</div></div>';}
function adminPage(){
 if(!userIsAdmin())return '<div class="empty">Acesso restrito.</div>';
 return '<div class="standalone"><div class="admin-banner"><div><h3>Gestão do diretório</h3><p>Gerencie responsáveis, regiões e publicações. As alterações ficam registradas no banco.</p></div><button class="btn primary" data-action="new">'+ic('edit')+' Adicionar contato</button></div><div class="admin-grid"><button data-action="nav" data-page="importar" class="admin-tile">'+ic('upload',26)+'<strong>Importar arquivo</strong><span>Excel / CSV com conferência</span></button><button data-action="new" class="admin-tile">'+ic('users',26)+'<strong>Editar contato</strong><span>Cadastro individual e atualização</span></button><button data-action="nav" data-page="diretorio" class="admin-tile">'+ic('search',26)+'<strong>Consultar diretório</strong><span>'+state.contacts.length+' contatos disponíveis</span></button><button data-action="nav" data-page="usuarios" class="admin-tile">'+ic('users',26)+'<strong>Usuários e senhas</strong><span>Cadastro com matrícula individual</span></button></div><h3 class="subheading">Últimas importações</h3>'+renderBatches()+'</div>';
}
function renderBatches(){
 if(!state.batches.length)return '<div class="panel"><p class="panel-hint">Nenhuma importação registrada no banco.</p></div>';
 return '<div class="panel batches">'+state.batches.map(b=>'<div class="batch-row"><div><strong>'+h(new Date(b.created_at).toLocaleString('pt-BR'))+'</strong><small>'+h((b.clusters||[]).join(', '))+' · '+h(b.mode)+' · '+b.row_count+' linhas</small></div><div><span class="tag">'+b.added+' novos</span> <span class="tag">'+b.changed+' alterados</span> <span class="tag">'+b.removed+' removidos</span></div><button class="btn subtle" data-action="restore" data-id="'+h(b.id)+'" title="Esta ação substitui o diretório atual">Restaurar anterior</button></div>').join('')+'</div>';
}
function importPage(){
 if(!userIsAdmin())return '<div class="empty">Acesso restrito.</div>';
 const data=state.upload;
 let preview='';
 if(data){
  const diff=importPreview(state.contacts,data.valid,state.importMode);
  const previewRows=data.valid.filter(c=>normalizeText([c.cluster,c.area,c.cidade,c.topologia,c.full_name,c.cargo,c.nivel,c.notes].join(' ')).includes(normalizeText(data.previewQuery)));
  preview='<section class="panel import-preview"><h3>Prévia da importação</h3><p>Arquivo: '+h(data.name)+'</p><p><strong>'+data.valid.length+'</strong> registros de contato e abrangência · <strong>'+data.errors.length+'</strong> inconsistências · <strong>'+diff.duplicates+'</strong> duplicidades potenciais</p><p>Cada linha da planilha é preservada. O mesmo gestor pode aparecer em cidades, áreas, topologias e níveis diferentes, inclusive em linhas iguais.</p><div class="import-metrics"><div><strong>'+diff.added+'</strong><span>Novos</span></div><div><strong>'+diff.changed+'</strong><span>Alterados</span></div><div><strong>'+diff.removed+'</strong><span>Removidos</span></div><div><strong>'+diff.unchanged+'</strong><span>Sem alterações</span></div></div><p><strong>Clusters identificados:</strong> '+h(diff.clusters.join(', ')||'Nenhum')+'</p>'+
  (data.sheets?.length?'<details><summary>Leitura por aba</summary><ul>'+data.sheets.map(s=>'<li>'+h(s.sheet)+': '+(s.kind==='reference'?'referência de cidades':s.kind==='organogram'?'organograma visual, sem importação de contatos':s.contacts+' registros')+'</li>').join('')+'</ul></details>':'')+
  (data.warnings?.length?'<div class="warning"><strong>'+data.warnings.length+' avisos para conferir</strong><ul>'+data.warnings.map(w=>'<li>'+h(w.sheet)+(w.row?' · linha '+w.row:'')+': '+h(w.message)+'</li>').join('')+'</ul><label><input type="checkbox" id="importReviewed" '+(data.reviewed?'checked':'')+'/> Conferi os avisos e a abrangência dos contatos.</label></div>':'')+
  '<div class="import-mode"><label><input type="radio" name="mode" value="merge" '+(state.importMode==='merge'?'checked':'')+'/> Mesclar e atualizar sem remover</label><label><input type="radio" name="mode" value="replace_clusters" '+(state.importMode==='replace_clusters'?'checked':'')+'/> Substituir apenas os clusters importados</label></div>'+
  (state.importMode==='replace_clusters'?'<p class="warning">'+ic('alert')+' Este modo poderá remover contatos de '+h(diff.clusters.join(', '))+'. Nenhum outro cluster será afetado.</p>':'')+
  (data.errors.length?'<div class="error-list"><strong>Corrija as inconsistências antes de publicar:</strong><ul>'+data.errors.slice(0,15).map(x=>'<li>'+h(x.sheet)+' · linha '+x.row+': '+h(x.message)+'</li>').join('')+'</ul>'+(data.errors.length>15?'<p>... e outras '+(data.errors.length-15)+' inconsistências.</p>':'')+'</div>':'')+
  '<form id="importPreviewFilter" class="search-row"><label class="search-wrap"><span>Conferir registros</span><input name="previewQuery" type="search" placeholder="Nome, cidade, área ou aba" value="'+h(data.previewQuery||'')+'"/></label><button class="btn subtle" type="submit">Filtrar prévia</button></form><p>Exibindo '+Math.min(30,previewRows.length)+' de '+previewRows.length+' registros deste filtro.</p><div class="table-overflow"><table class="preview-table"><thead><tr><th>Cluster</th><th>Área</th><th>Cidade</th><th>Topologia / mercado</th><th>Nome</th><th>Nível</th><th>Telefone</th><th>Origem na planilha</th></tr></thead><tbody>'+previewRows.slice(0,30).map(c=>'<tr><td>'+h(c.cluster)+'</td><td>'+h(c.area)+'</td><td>'+h(c.cidade)+'</td><td>'+h(c.topologia)+'</td><td>'+h(c.full_name)+'</td><td>'+h(c.nivel)+'</td><td>'+h(c.phone_display)+'</td><td>'+h(c.notes?.match(/^Origem: (.*)$/m)?.[1]||'Cadastro sem linha de origem')+'</td></tr>').join('')+'</tbody></table></div>'+
  '<button class="btn primary publish" data-action="publish" '+(state.busy||!data.valid.length||data.errors.length||diff.duplicates||(data.warnings?.length&&!data.reviewed)?'disabled':'')+'>'+ic('check')+' '+(state.busy?'Publicando...':'Confirmar publicação')+'</button>'+(diff.duplicates?'<p class="warning">Há duplicidades; revise a base antes da publicação.</p>':'')+'</section>';
 }
 return '<div class="standalone"><div class="panel import-intro"><h3>'+ic('upload')+' Importação segura</h3><p>Envie Excel (.xlsx / .xls) ou CSV. Aceita o modelo de escalonamento com blocos por nível, células mescladas e referência de cidades de MG. A leitura acontece neste navegador e só grava no banco após sua confirmação.</p><label class="file-pick">Selecionar planilha<input type="file" id="importFile" accept=".csv,.xlsx,.xls" '+(state.busy?'disabled':'')+'/></label><p class="panel-hint">Limites: 5 MB e 2.000 registros após distribuir as abrangências por cidade. Clusters são identificados por nome, nunca pela posição da aba.</p></div>'+preview+'<h3 class="subheading">Histórico de versões</h3>'+renderBatches()+'</div>';
}
function usersPage(){
 if(!userIsAdmin())return '<div class="empty">Acesso restrito.</div>';
 const validated=state.roster;
 const users=state.accounts.filter(x=>x.login_id);
 const ready=validated&&validated.data.length>0&&validated.errors.length===0;
 const credentials=state.credentials;
 const credsHtml=credentials.length?
  '<section class="panel credentials" aria-label="Senhas provisórias"><h3>'+ic('alert')+' Credenciais geradas — visualização temporária</h3><p>As senhas são <strong>individuais</strong>, geradas aleatoriamente e deverão ser trocadas no primeiro acesso. Não são salvas no portal. Entregue cada senha exclusivamente ao seu titular por canal seguro. Caso perca uma senha, utilize Redefinir.</p><div class="toolbar"><button class="btn subtle" data-action="clear-credentials">Apagar senhas da tela</button></div><div class="table-overflow"><table class="preview-table account-table"><thead><tr><th>Matrícula</th><th>Nome</th><th>Situação</th><th>Senha provisória</th></tr></thead><tbody>'+
  credentials.map(u=>'<tr><td><strong>'+h(u.login)+'</strong></td><td>'+h(u.nome)+'</td><td>'+h(({created:'Criado',exists:'Já cadastrado',error:'Erro'})[u.status]||'Desconhecido')+'</td><td>'+(u.temporaryPassword?'<code>'+h(u.temporaryPassword)+'</code> <button class="icon-btn" data-action="copy-password" data-login="'+h(u.login)+'" title="Copiar senha">'+ic('copy')+'</button>':'—')+'</td></tr>').join('')+'</tbody></table></div></section>':'';
 return '<div class="standalone"><section class="panel users-intro"><h3>'+ic('users')+' Contas individuais</h3><p>O acesso será realizado por <strong>matrícula + senha pessoal</strong>. Cada usuário recebe uma senha provisória exclusiva e precisará substituí-la no primeiro login. A senha pessoal é cadastrada pelo próprio analista e não fica visível ao administrador.</p><p class="panel-hint">Somente administradores podem criar, suspender ou redefinir os acessos.</p></section>'+
 '<section class="panel roster-panel"><h3>Importar usuários</h3>'+(state.pendingRoster.length?'<p><strong>'+state.pendingRoster.length+' analistas</strong> na lista privada preparada para cadastro.</p><button class="btn subtle" data-action="load-pending-roster">Carregar lista dos analistas</button>':'')+'<p>Cole a tabela de LOGIN e NOME no formato Markdown, CSV ou colunas separadas por TAB. Serão aceitos até 100 usuários por importação. Contas já existentes não serão recriadas.</p><label class="file-pick">Selecionar CSV de usuários<input type="file" id="usersImportFile" accept=".csv,.txt" '+(state.busy?'disabled':'')+'/></label><label class="field"><span>Base de usuários</span><textarea id="rosterText" class="roster-input" placeholder="LOGIN;NOME&#10;F000001;NOME EXEMPLO" rows="6" '+(state.busy?'disabled':'')+'>'+h(state.rosterRaw)+'</textarea></label><div class="toolbar"><button class="btn subtle" data-action="validate-roster" '+(state.busy?'disabled':'')+'>'+ic('check')+' Validar lista</button>'+(ready?'<button class="btn primary" data-action="create-roster" '+(state.busy?'disabled':'')+'>'+ic('users')+' '+(state.busy?'Cadastrando...':'Criar contas individuais')+'</button>':'')+'</div>'+
 (validated?'<p><strong>'+validated.data.length+'</strong> matrícula(s) válidas e <strong>'+validated.errors.length+'</strong> inconsistência(s).</p>'+
 (validated.errors.length?'<div class="error-list"><ul>'+validated.errors.slice(0,12).map(x=>'<li>Linha '+x.line+': '+h(x.message)+'</li>').join('')+'</ul></div>':'')+
 '<div class="table-overflow"><table class="preview-table"><thead><tr><th>Matrícula</th><th>Nome</th></tr></thead><tbody>'+validated.data.slice(0,12).map(x=>'<tr><td>'+h(x.login)+'</td><td>'+h(x.nome)+'</td></tr>').join('')+'</tbody></table></div><p class="panel-hint">Visualização parcial de até 12 registros.</p>':'')+'</section>'+
 credsHtml+
 '<h3 class="subheading">Usuários cadastrados ('+users.length+')</h3><div class="panel"><div class="table-overflow"><table class="preview-table account-table"><thead><tr><th>LOGIN</th><th>Nome</th><th>Perfil</th><th>Acesso</th><th>Senha</th><th>Ações</th></tr></thead><tbody>'+
 (users.length?users.map(u=>'<tr><td><strong>'+h(u.login_id)+'</strong></td><td>'+h(u.display_name)+'</td><td>'+h(u.role)+'</td><td><span class="tag '+(u.active?'blue':'warn')+'">'+(u.active?'Ativo':'Inativo')+'</span></td><td>'+ (u.must_change_password?'Troca pendente':'Pessoal')+'</td><td><button class="btn subtle" data-action="reset-account" data-id="'+h(u.id)+'" '+(u.role!=='viewer'?'disabled':'')+'>Redefinir</button> <button class="btn subtle" data-action="toggle-account" data-id="'+h(u.id)+'" data-active="'+(u.active?'false':'true')+'" '+(u.role!=='viewer'?'disabled':'')+'>'+(u.active?'Desativar':'Ativar')+'</button></td></tr>').join(''):'<tr><td colspan="6">Nenhum usuário provisionado.</td></tr>')+'</tbody></table></div></div></div>';
}
function renderUserAudit(){
 const events={promote_admin:'Promoção a administrador',create:'Conta criada',reset:'Senha redefinida',activate:'Acesso reativado',deactivate:'Acesso bloqueado',change_password:'Senha pessoal alterada'};
 const identity=id=>state.accounts.find(u=>u.id===id)?.login_id||id;
 return '<h3 class="subheading">Histórico administrativo</h3><div class="panel"><div class="table-overflow"><table class="preview-table"><thead><tr><th>Data</th><th>Operador</th><th>Conta</th><th>Ação</th></tr></thead><tbody>'+(state.audit||[]).map(a=>'<tr><td>'+h(new Date(a.created_at).toLocaleString('pt-BR'))+'</td><td>'+h(identity(a.actor))+'</td><td>'+h(identity(a.target))+'</td><td>'+h(events[a.event]||a.event)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function initialSetupView(){
 return '<div class="auth-screen"><div class="auth-card"><h1>Ativar administrador</h1><p>Defina a senha pessoal da conta administrativa. Este link só pode ser usado uma vez.</p><form id="initialSetupForm"><label>Nova senha pessoal<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><label>Confirme a senha<input name="confirmation" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><button class="btn primary" type="submit" '+(state.busy?'disabled':'')+'>Ativar acesso</button></form></div></div>';
}
function passwordChangeView(){
 return '<div class="auth-screen"><div class="auth-card"><div class="auth-logo official-logo">'+brandIcon(72)+'</div><span class="overline">SENHA PESSOAL</span><h1>Altere sua senha</h1><p>Informe a senha atual e escolha uma nova senha pessoal. No primeiro acesso, esta troca é obrigatória.</p><form id="changePasswordForm"><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" required/></label><label>Nova senha pessoal (mínimo 12 caracteres)<input name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><label>Confirme a nova senha<input name="confirmation" type="password" minlength="12" autocomplete="new-password" required/></label><button class="btn primary" type="submit" '+(state.busy?'disabled':'')+'>'+(state.busy?'Atualizando...':'Alterar senha e entrar')+'</button></form><button class="btn subtle" data-action="logout">Sair da conta</button></div></div>';
}
function renderPage(){return ({consultar:consultation,diretorio:directory,favoritos:favoritesPage,recentes:recentPage,administracao:adminPage,importar:importPage,usuarios:usersPage,alteracoes:()=>reportsPage({reports:state.reports,accounts:state.accounts,admin:userIsAdmin(),loading:state.reportsLoading,error:state.reportsError,filter:state.reportFilter})})[state.view]?.()||consultation();}
function renderModal(){
 if(state.modal?.startsWith('report:')){const c=state.contacts.find(c=>c.id===state.modal.slice(7));return c?reportDialog(c,state.reportDraft?.id===c.id?state.reportDraft:{},state.reportPending):'';}
 if(state.modal?.startsWith('review:')){const r=state.reports.find(r=>r.id===state.modal.slice(7));return userIsAdmin()&&r?reviewDialog(r,state.reviewDraft?.id===r.id?state.reviewDraft:{},state.reportPending):'';}
 const c=state.modal==='new'?{}:state.contacts.find(item=>item.id===state.modal)||{};
 const textInput=(name,label,val,required='')=>'<label class="field"><span>'+label+'</span><input name="'+name+'" value="'+h(val||'')+'" '+required+'/></label>';
 const select=(name,label,values,current)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+values.map(v=>'<option '+(v===current?'selected':'')+'>'+h(v)+'</option>').join('')+'</select></label>';
 return '<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" aria-label="Editar contato"><div class="modal-top"><h3>'+(c.id?'Editar contato':'Novo contato')+'</h3><button class="icon-btn" data-action="close-modal" aria-label="Fechar">×</button></div><form id="contactForm" class="edit-grid">'+select('cluster','Cluster',CLUSTERS,c.cluster||'RJ')+textInput('area','Área',c.area)+textInput('cidade','Cidade / Localidade',c.cidade)+textInput('topologia','Topologia',c.topologia)+textInput('full_name','Nome completo',c.full_name,'required')+textInput('cargo','Cargo',c.cargo)+textInput('nivel','Nível de escalonamento',c.nivel)+textInput('phone_e164','Telefone com DDD',c.phone_display||c.phone_e164,'required')+select('scope','Abrangência',['local','regional'],c.scope||'local')+textInput('notes','Observações',c.notes)+textInput('valid_from','Válido a partir de (AAAA-MM-DD)',c.valid_from)+textInput('valid_until','Válido até (AAAA-MM-DD)',c.valid_until)+'<label class="check-field"><input type="checkbox" name="active" '+(c.active!==false?'checked':'')+'/> Contato ativo</label><div class="modal-actions"><button type="button" class="btn subtle" data-action="close-modal">Cancelar</button><button type="submit" class="btn primary" '+(state.busy?'disabled':'')+'>Salvar contato</button></div></form></div></div>';
}
function loginView(){
 const dark=document.documentElement.dataset.theme==='dark';
 return '<div class="login-screen"><div class="login-layout"><aside class="login-story" aria-label="Central COP — Escalonamentos"><div class="login-brand">'+brandIcon(64)+'<div><strong>Central COP</strong><span>ESCALONAMENTOS</span></div></div><div class="login-story-copy"><span class="login-eyebrow">CENTRAL DE OPERAÇÕES</span><h2>Gestão de escalonamentos<br>operacionais.</h2><p>Encontre os responsáveis por região, localidade e nível de atendimento.</p><div class="login-capabilities"><span>'+ic('map',16)+' Regiões</span><span>'+ic('users',16)+' Responsáveis</span><span>'+ic('phone',16)+' Contatos</span></div></div><div class="login-story-footer"><span class="login-status-dot"></span>Portal interno · Equipe COP</div></aside><section class="login-main" aria-labelledby="login-title"><header class="login-main-top"><span>ACESSO AO PORTAL</span><button type="button" class="login-theme" data-action="theme" aria-pressed="'+dark+'" aria-label="'+(dark?'Ativar tema claro':'Ativar tema escuro')+'" title="'+(dark?'Ativar tema claro':'Ativar tema escuro')+'">'+ic(dark?'settings':'moon',19)+'</button></header><div class="login-form-wrap"><div class="login-mobile-brand">'+brandIcon(56)+'<strong>Central COP<span>ESCALONAMENTOS</span></strong></div><span class="overline">BEM-VINDO À CENTRAL COP</span><h1 id="login-title">Entre na sua conta</h1><p class="login-lead">Acesse o diretório de contatos e escalonamentos da sua operação.</p><form id="loginForm" aria-busy="'+Boolean(state.loginPending)+'"><label for="login-user">Matrícula ou e-mail</label><div class="login-input">'+ic('users',18)+'<input id="login-user" type="text" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Sua matrícula ou e-mail" /></div><small class="login-id-hint">A matrícula aceita maiúsculas e minúsculas.</small><div class="login-password-heading"><label for="login-password">Senha</label><span>Seu acesso pessoal</span></div><div class="login-input">'+ic('lock',18)+'<input id="login-password" type="password" name="password" required autocomplete="current-password" placeholder="Digite sua senha" /><button type="button" class="password-toggle" data-action="toggle-password" aria-controls="login-password" aria-label="Mostrar senha" aria-pressed="false">'+ic('eye',19)+'</button></div><button class="btn primary login-submit" type="submit" '+(state.loginPending?'disabled':'')+'><span>'+(state.loginPending?'Entrando…':'Entrar no portal')+'</span>'+ic('chevron',18)+'</button></form><div class="login-access-note">'+ic('info',18)+'<p><strong>Precisa de acesso?</strong><br>Solicite seu cadastro ao administrador do portal.</p></div></div><footer class="login-footer">'+ic('lock',14)+' Acesso exclusivo para usuários autorizados</footer></section></div></div>';
}
function clearPrivateState(){
 state.shareMode='auto';state.sharePending=false;
 try{if(state.user?.id)sessionStorage.removeItem('cop-consultation:'+state.user.id);}catch{}
 state.sessionEpoch=(state.sessionEpoch||0)+1;
 state.pendingRoster=[];state.user=null;state.contacts=[];state.accounts=[];state.batches=[];state.audit=[];state.upload=null;
 state.credentials=[];state.roster=null;state.rosterRaw='';state.modal=null;state.view='consultar';
 state.recent=[];state.favorites=[];
 state.filters={cluster:'',area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:''};state.mobileMenu=false;
 state.contactDraft=null;
}
const authNotice=()=>state.notice?'<div class="toast '+h(state.notice.kind)+'" role="status">'+h(state.notice.message)+'</div>':'';
function rememberConsultation(){
 if(!state.user?.active)return;
 try{sessionStorage.setItem('cop-consultation:'+state.user.id,JSON.stringify({view:['consultar','diretorio','favoritos','recentes'].includes(state.view)?state.view:'consultar',filters:state.filters}));}catch{}
}
function captureDraft(){
 const report=document.querySelector('#reportForm');
 if(report)state.reportDraft={id:report.dataset.id,reason:report.elements.reason.value,message:report.elements.message.value};
 const review=document.querySelector('#reportReviewForm');
 if(review)state.reviewDraft={id:review.dataset.id,note:review.elements.note.value};
 const query=document.querySelector('#mainSearch,#directorySearch');if(query)state.filters.query=query.value;
 const roster=document.querySelector('#rosterText');if(roster)state.rosterRaw=roster.value;
 const form=document.querySelector('#contactForm');
 if(form&&userIsAdmin())state.contactDraft={id:state.modal,fields:Array.from(form.elements).filter(el=>el.name&&el.type!=='password').map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}))};
}
function restoreDraft(){
 if(!state.modal){state.contactDraft=null;return;}
 const draft=state.contactDraft,form=document.querySelector('#contactForm');
 if(!form||!userIsAdmin()||draft?.id!==state.modal)return;
 for(const item of draft.fields){const field=form.elements.namedItem(item.name);if(field){if(item.type==='checkbox')field.checked=item.checked;else field.value=item.value;}}
}
async function loadReports(){
 if(state.reportsLoading)return;
 const epoch=state.sessionEpoch||0;
 state.reportsLoading=true;state.reportsError='';render();
 try{const rows=await store.reports();if(epoch===(state.sessionEpoch||0))state.reports=rows;}
 catch(error){if(epoch===(state.sessionEpoch||0)){state.reports=[];state.reportsError='Não foi possível carregar as informações. Tente atualizar a lista.';}}
 finally{if(epoch===(state.sessionEpoch||0)){state.reportsLoading=false;render();}}
}
function closeReportModal(){
 const target=state.modalReturn;
 state.modal=null;state.reportDraft=null;state.reviewDraft=null;state.modalReturn=null;render();
 if(target)Array.from(root.querySelectorAll('button[data-action]')).find(b=>b.dataset.action===target.action&&b.dataset.id===target.id)?.focus();
}
function restoreConsultation(){
 try{
  const saved=JSON.parse(sessionStorage.getItem('cop-consultation:'+state.user.id)||'null');
  if(!saved||!['consultar','diretorio','favoritos','recentes'].includes(saved.view))return;
  state.view=saved.view;
  for(const key of Object.keys(state.filters))if(typeof saved.filters?.[key]==='string')state.filters[key]=saved.filters[key].slice(0,300);
  if(!CLUSTERS.includes(state.filters.cluster))state.filters.cluster='';
 }catch{}
}
function connectionView(){return '<div class="auth-screen"><section class="auth-card connection-card" role="status"><div class="auth-logo">'+ic('refresh',32)+'</div><span class="overline">CENTRAL COP</span><h1>'+(state.connection==='checking'?'Validando acesso…':'Consulta indisponível')+'</h1><p>'+(state.connection==='checking'?'Aguarde enquanto recuperamos sua sessão e verificamos os dados atuais.':'Não foi possível confirmar a conexão e validar sua sessão. Os contatos ficam ocultos até a reconexão; sua consulta será recuperada se a sessão continuar válida.')+'</p><button class="btn primary" data-action="retry-session">Tentar novamente</button></section></div>';}
function render(){
 if(mobile()&&state.view==='nice')state.view='consultar';
 rememberConsultation();
 if(store.configurationError){root.innerHTML='<div class="auth-screen"><div class="auth-card"><h1>Serviço indisponível</h1><p>'+h(store.configurationError)+'</p></div></div>';return;}
 if(state.connection!=='online'){root.innerHTML=connectionView();return;}
 if(state.setupToken){root.innerHTML=initialSetupView()+authNotice();return;}
 if(state.loading){root.innerHTML='<div class="loading">'+ic('refresh',34)+' Carregando Central COP...</div>';return;}
 if(store.configured && state.user?.active && (state.user.must_change_password||state.view==='senha')){root.innerHTML=passwordChangeView()+authNotice();return;}
 if(store.configured && !state.user?.active){root.innerHTML=state.user?.role==='pending'?'<div class="auth-screen"><div class="auth-card"><h2>Acesso pendente</h2><p>Seu usuário ainda não foi liberado. Procure o administrador.</p><button class="btn primary" data-action="logout">Sair</button></div></div>':loginView();root.insertAdjacentHTML('beforeend',authNotice());return;}
 root.innerHTML=renderShell();
 restoreDraft();
}
async function refresh(){
 const epoch=state.sessionEpoch||0,id=state.user?.id;
 const contacts=await store.contacts();
 let metadata;
 if(userIsAdmin()){
   metadata=await Promise.all([store.batches(),store.users(),store.userAudit(),store.pendingRoster()]);
 }
 if(epoch!==(state.sessionEpoch||0)||id!==state.user?.id)return;
 state.contacts=contacts;
 if(metadata)[state.batches,state.accounts,state.audit,state.pendingRoster]=metadata;
 render();
}
async function init(){
 try{if(navigator.onLine===false)throw Error('offline');state.user=await store.session();loadPreferences();if(state.user?.active)restoreConsultation();if(store.demo||(state.user?.active&&!state.user.must_change_password))await refresh();}
 catch{state.connection='unavailable';}
 finally{state.loading=false;render();}
}
const preferenceKey=key=>key+':'+(state.user?.id||'demo');
function loadPreferences(){state.favorites=storage(preferenceKey('cop-favorites'),[]);state.recent=storage(preferenceKey('cop-recent'),[]);}
function saveRecent(){
 const q=state.filters.query,cluster=state.filters.cluster;
 const label=q||('Cluster '+(cluster||'todos'));
 const item={query:q,cluster,label,time:new Date().toLocaleString('pt-BR')};
 state.recent=[item,...state.recent.filter(i=>!(i.query===q&&i.cluster===cluster))].slice(0,8);
 setStorage(preferenceKey('cop-recent'),state.recent);
}
function copyText(text) {
 if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
 const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();
 document.execCommand('copy');el.remove();return Promise.resolve();
}
root.addEventListener('submit',async e=>{
 if(e.target.id==='reportForm'||e.target.id==='reportReviewForm'){
  e.preventDefault();if(store.demo||state.reportPending)return;
  const review=e.target.id==='reportReviewForm';if(review&&!userIsAdmin())return;
  const form=new FormData(e.target),id=e.target.dataset.id,epoch=state.sessionEpoch||0;
  captureDraft();state.reportPending=true;render();
  try{
   if(review)await store.reviewContactReport(id,String(form.get('note')||''));
   else await store.submitContactReport(id,String(form.get('reason')),String(form.get('message')||''));
   if(epoch!==(state.sessionEpoch||0))return;
   closeReportModal();toast(review?'Análise concluída.':'Informação enviada para análise.','success');
   if(state.view==='alteracoes')await loadReports();
  }catch(error){if(epoch===(state.sessionEpoch||0))toast(error.message||'Não foi possível enviar. Tente novamente.','error');}
  finally{if(epoch===(state.sessionEpoch||0)){state.reportPending=false;if(state.modal)render();}}
  return;
 }
 if(e.target.id==='importPreviewFilter'){e.preventDefault();if(state.upload){state.upload.previewQuery=String(new FormData(e.target).get('previewQuery')||'');render();}return;}
 if(e.target.id==='initialSetupForm'){
  e.preventDefault();if(state.busy)return;
  const form=new FormData(e.target),password=String(form.get('password')||'');
  if(password!==String(form.get('confirmation')||'')){toast('As senhas não coincidem.','error');return;}
  state.busy=true;
  try{await store.initialSetup(state.setupToken,password);state.setupToken='';clearPrivateState();render();toast('Administrador ativado. Entre com seu login e sua senha pessoal.','success');}
  catch(error){toast(error.message,'error');}
  finally{state.busy=false;}
  return;
 }

 if(e.target.id==='searchForm'||e.target.id==='directoryForm'){
  e.preventDefault();state.filters.query=new FormData(e.target).get('query')?.trim()||'';saveRecent();render();return;
 }
 if(e.target.id==='loginForm'){
  e.preventDefault();if(state.loginPending)return;
  const f=new FormData(e.target);state.loginPending=true;
  const submit=e.target.querySelector('[type="submit"]');
  e.target.setAttribute('aria-busy','true');submit.disabled=true;submit.querySelector('span').textContent='Entrando…';
  try{
  try{state.user=await store.signIn(String(f.get('email')),String(f.get('password')));}
  catch(error){toast(['session','network'].includes(error.stage)?error.message:'Não foi possível entrar. Confira matrícula e senha ou procure o administrador.','error');return;}
  loadPreferences();
  try{if(state.user?.active&&!state.user.must_change_password)await refresh();else render();}
  catch{render();toast('Login confirmado, mas não foi possível carregar os dados. Recarregue a página para tentar novamente.','error');}
  }finally{
   state.loginPending=false;
   const form=root.querySelector('#loginForm');
   if(form){form.setAttribute('aria-busy','false');const button=form.querySelector('[type="submit"]');button.disabled=false;button.querySelector('span').textContent='Entrar no portal';}
  }
  return;
 }
 if(e.target.id==='changePasswordForm'){
  e.preventDefault();
  if(state.busy)return;
  const form=new FormData(e.target);
  const current=String(form.get('currentPassword')||'');
  const next=String(form.get('newPassword')||'');
  if(next!==String(form.get('confirmation')||'')){toast('As senhas não coincidem.','error');return;}
  if(next.length<12||next===current){toast('Escolha uma senha diferente com pelo menos 12 caracteres.','error');return;}
  state.busy=true;
  try{
    const result=await store.changePassword(current,next);
    if(result.reauthenticate){
      await store.signOut();clearPrivateState();state.view='consultar';render();
      toast('Senha alterada. Entre novamente com sua nova senha.','success');return;
    }
    state.user=await store.session();
    if(!state.user?.active||state.user.must_change_password)throw Error('A liberação da conta ainda está pendente.');
    state.view='consultar';await refresh();toast('Senha pessoal definida com sucesso.','success');
  }catch(err){toast('Falha na troca: '+err.message,'error');}
  finally{state.busy=false;}
  return;
 }
 if(e.target.id==='contactForm'){
  e.preventDefault();if(state.busy)return;
  const f=new FormData(e.target),phone=normalizePhone(f.get('phone_e164'));
  if(!phone.valid){toast('Telefone inválido: '+phone.error,'error');return;}
  const values={};for(const key of ['cluster','area','cidade','topologia','full_name','cargo','nivel','notes','scope'])values[key]=String(f.get(key)||'').trim();
  for(const field of ['valid_from','valid_until'])values[field]=String(f.get(field)||'').trim()||null;
  if(values.valid_from&&!/^\d{4}-\d{2}-\d{2}$/.test(values.valid_from)||values.valid_until&&!/^\d{4}-\d{2}-\d{2}$/.test(values.valid_until)){toast('Use datas AAAA-MM-DD.','error');return;}
  if(values.valid_from&&values.valid_until&&values.valid_from>values.valid_until){toast('Vigência inicial posterior à final.','error');return;}
  values.phone_e164=phone.e164;values.phone_display=phone.display;values.active=Boolean(f.get('active'));
  if(state.modal!=='new')values.id=state.modal;
  state.busy=true;
  try{await store.saveContact(values);state.modal=null;await refresh();toast('Contato salvo no diretório.','success');}
  catch(err){toast('Não foi possível salvar: '+err.message,'error');}
  finally{state.busy=false;}return;
 }
});
root.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='login-user'){if(!el.value.includes('@'))el.value=normalizeLogin(el.value);return;}
 if(el.matches('[data-report-filter]')){state.reportFilter=el.value;render();return;}
 if(el.id==='usersImportFile'){
  if(!userIsAdmin()||state.busy)return;
  const file=el.files?.[0];if(!file)return;
  state.upload=null;
  if(file.size>1024*1024){toast('O arquivo de usuários excede 1 MB.','error');return;}
  try{
    const raw=await file.text();
    const parsed=parseRoster(raw);
    if(parsed.data.length>100)throw Error('Limite de 100 pessoas por arquivo.');
    state.rosterRaw=raw;state.roster=parsed;render();
    if(parsed.errors.length)toast('Foram encontradas inconsistências na lista. Corrija antes de cadastrar.','error');
  }catch(err){toast('Erro ao ler CSV: '+err.message,'error');}
  return;
 }
 if(el.matches('[data-filter]')){state.filters[el.dataset.filter]=el.value;render();return;}
 if(el.name==='mode'){state.importMode=el.value;render();return;}
 if(el.id==='importReviewed'&&state.upload){state.upload.reviewed=el.checked;render();return;}
 if(el.id==='importFile'){
  const file=el.files?.[0];if(!file)return;
  state.upload=null;
  if(file.size>5*1024*1024){render();toast('Arquivo maior que 5 MB.','error');return;}
  try{
   let tables=[];
   if(/\.csv$/i.test(file.name)){tables=[{sheet:'CSV',rows:parseCsv(await file.text())}];}
   else if(/\.(xlsx|xls)$/i.test(file.name)){
    if(!window.XLSX)throw Error('Biblioteca de Excel indisponível. Verifique sua conexão.');
    const wb=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellComments:true});
    tables=wb.SheetNames.map(sheet=>({sheet,rows:window.XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:false,range:0}),merges:wb.Sheets[sheet]['!merges']||[]}));
   }else throw Error('Use CSV, XLS ou XLSX.');
   const parsed=parseWorkbook(tables);
   if(parsed.valid.length>2000)throw Error('Limite de 2.000 contatos por arquivo.');
   state.upload={name:file.name,...parsed};state.importMode='merge';render();
  }catch(err){render();toast('Erro de leitura: '+err.message,'error');}
 }
});
root.addEventListener('click',async e=>{
 const btn=e.target.closest('button,[data-contact]');if(!btn)return;
 if(btn.dataset.contact){ // registro local de acesso a contato; não atesta ligação
  const c=state.contacts.find(c=>c.id===btn.dataset.contact);
  if(c){state.recent=[{query:c.full_name,cluster:c.cluster,label:c.full_name,time:new Date().toLocaleString('pt-BR')},...state.recent].slice(0,8);setStorage(preferenceKey('cop-recent'),state.recent);}
  return;
 }
 const action=btn.dataset.action;
 if(!action)return;
 if(action==='toggle-password'){
  const input=root.querySelector('#login-password');if(!input)return;
  const show=input.type==='password';input.type=show?'text':'password';
  btn.setAttribute('aria-pressed',String(show));btn.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');return;
 }
 if(action==='theme'){
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;try{localStorage.setItem('cop-theme',next);}catch{}
  if(root.querySelector('#loginForm')){
   btn.setAttribute('aria-pressed',String(next==='dark'));
   btn.setAttribute('aria-label',next==='dark'?'Ativar tema claro':'Ativar tema escuro');btn.title=btn.getAttribute('aria-label');btn.innerHTML=ic(next==='dark'?'settings':'moon',19);return;
  }
  captureDraft();render();return;
 }
 if(action==='retry-session'){await recoverSession({reload:true});return;}
 if(state.connection!=='online')return;
 if(action==='reports-refresh'){await loadReports();return;}
 if(action==='report'){
  if(store.demo||!state.contacts.some(c=>c.id===btn.dataset.id))return;
  state.modalReturn={action,id:btn.dataset.id};state.reportDraft=null;state.modal='report:'+btn.dataset.id;render();root.querySelector('#reportForm select')?.focus();return;
 }
 if(action==='report-review'){
  if(!userIsAdmin()||!state.reports.some(r=>r.id===btn.dataset.id&&r.status==='open'))return;
  state.modalReturn={action,id:btn.dataset.id};state.reviewDraft=null;state.modal='review:'+btn.dataset.id;render();root.querySelector('#reportReviewForm textarea')?.focus();return;
 }
 if(action==='report-edit'){
  if(!userIsAdmin()||!state.contacts.some(c=>c.id===btn.dataset.id))return;
  state.modal=btn.dataset.id;render();root.querySelector('#contactForm input')?.focus();return;
 }
 if(action==='mobile-menu'){state.mobileMenu=!state.mobileMenu;render();return;}
 if(action==='change-password'){state.credentials=[];state.view='senha';render();return;}
 if(action==='nav'){
  state.mobileMenu=false;
  if(state.view==='usuarios'&&btn.dataset.page!=='usuarios'){
    state.credentials=[];state.roster=null;state.rosterRaw='';
  }
  state.view=btn.dataset.page;render();if(state.view==='alteracoes')await loadReports();return;
 }
 if(action==='load-pending-roster'){
  if(!userIsAdmin()||state.busy)return;
  state.rosterRaw='LOGIN;NOME\n'+state.pendingRoster.map(u=>u.login_id+';'+u.display_name).join('\n');
  state.roster=parseRoster(state.rosterRaw);render();return;
 }
 if(action==='validate-roster'){
  if(!userIsAdmin())return;
  const text=document.getElementById('rosterText')?.value||'';
  const parsed=parseRoster(text);
  if(parsed.data.length>100){toast('Limite de 100 pessoas por importação.','error');return;}
  state.roster=parsed;state.rosterRaw=text;
  render();return;
 }
 if(action==='create-roster'){
  if(!userIsAdmin()||state.busy||!state.roster?.data?.length||state.roster.errors.length)return;
  if(!confirm('Criar contas individuais com senhas provisórias aleatórias? As credenciais só serão exibidas nesta sessão.'))return;
  state.busy=true;state.credentials=[];render();
  const epoch=state.sessionEpoch||0;
  try {
    const result=await store.createUsers(state.roster.data,rows=>{if((state.sessionEpoch||0)===epoch){state.credentials=[...rows];render();}});
    if((state.sessionEpoch||0)!==epoch)return;
    state.credentials=result;state.roster=null;state.rosterRaw='';await refresh();
    toast('Cadastro finalizado. Confira os resultados e distribua as senhas individualmente.','success');
  }catch(err){toast('Falha durante a criação. Contas já cadastradas foram preservadas. '+err.message,'error');}
  finally{state.busy=false;render();}
  return;
 }
 if(action==='copy-password'){
  const entry=state.credentials.find(x=>x.login===btn.dataset.login);
  if(entry?.temporaryPassword){try{await copyText(entry.temporaryPassword);toast('Senha provisória copiada.','success');}catch{toast('Não foi possível copiar.','error');}}
  return;
 }
 if(action==='clear-credentials'){
  state.credentials=[];render();toast('Senhas provisórias retiradas da tela.','success');return;
 }
 if(action==='reset-account'){
  if(!userIsAdmin()||state.busy)return;
  const profile=state.accounts.find(x=>x.id===btn.dataset.id);
  if(!profile||profile.role!=='viewer')return;
  if(!confirm('Gerar uma NOVA senha provisória para '+profile.login_id+'? A senha anterior deixará de funcionar.'))return;
  state.busy=true;
  try{
    const epoch=state.sessionEpoch||0;
    const reply=await store.resetUserPassword(profile.id);
    if((state.sessionEpoch||0)!==epoch)return;
    state.credentials=[{login:profile.login_id,nome:profile.display_name,status:'created',temporaryPassword:reply.temporaryPassword}];
    await refresh();toast('Senha provisória redefinida. Entregue apenas ao titular.','success');
  }catch(err){toast('Não foi possível redefinir: '+err.message,'error');}
  finally{state.busy=false;render();}
  return;
 }
 if(action==='toggle-account'){
  if(!userIsAdmin()||state.busy)return;
  const profile=state.accounts.find(x=>x.id===btn.dataset.id);
  if(!profile||profile.role!=='viewer')return;
  const active=btn.dataset.active==='true';
  if(!confirm((active?'Reativar':'Desativar')+' acesso de '+profile.login_id+'?'))return;
  state.busy=true;
  try{await store.setUserActive(profile.id,active);await refresh();toast('Acesso atualizado.','success');}
  catch(err){toast('Falha ao alterar acesso: '+err.message,'error');}
  finally{state.busy=false;render();}
  return;
 }
 if(action==='cluster'){const cluster=state.filters.cluster===btn.dataset.cluster?'':btn.dataset.cluster;state.filters={cluster,area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:cluster?state.filters.query:''};render();root.querySelector('[data-action="cluster"][data-cluster="'+btn.dataset.cluster+'"]')?.focus({preventScroll:true});return;}
 if(action==='subgroup'){const area=btn.dataset.area||'';state.filters={...state.filters,area,cidade:'',topologia:'',cargo:'',nivel:''};render();Array.from(root.querySelectorAll('[data-action="subgroup"]')).find(b=>b.dataset.area===area)?.focus({preventScroll:true});return;}
 if(action==='clear'){state.filters={cluster:state.filters.cluster,area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:''};render();return;}
 if(action==='quick'){state.view='consultar';state.filters={...state.filters,query:'',area:'',cidade:'',topologia:'',cargo:'',nivel:''};render();document.querySelector(btn.dataset.mode==='city'?'[data-filter="cidade"]':'[data-filter="topologia"]')?.focus();return;}
 if(action==='favorite'){const id=btn.dataset.id;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[id,...state.favorites];setStorage(preferenceKey('cop-favorites'),state.favorites);render();return;}
 if(action==='recent'){state.filters={query:btn.dataset.query||'',cluster:btn.dataset.cluster||'',area:'',cidade:'',topologia:'',cargo:'',nivel:''};state.view='consultar';render();return;}
 if(action==='jump'){const c=state.contacts.find(x=>x.id===btn.dataset.id);if(c){state.filters={cluster:c.cluster,area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:c.full_name};state.view='consultar';render();}return;}
 if(action==='copy'){const c=state.contacts.find(x=>x.id===btn.dataset.id);if(!c)return;try{await copyText(c.phone_display||c.phone_e164||'');toast('Telefone copiado.','success');}catch{toast('Cópia não permitida neste navegador.','error');}return;}
 if(action==='share'){
  const c=state.contacts.find(x=>x.id===btn.dataset.id);if(!c||store.demo)return;
  if(state.sharePending)return;
  const epoch=state.sessionEpoch||0;
  state.sharePending=true;
  try{
   if(state.shareMode==='copy'){await copyText(contactShareText(c));if(epoch===(state.sessionEpoch||0))toast('Informações copiadas.','success');return;}
   const result=await shareContact(c,{copy:copyText});
   if(epoch!==(state.sessionEpoch||0))return;
   if(result.kind==='copy-required'){state.shareMode='copy';toast('Compartilhamento indisponível. Toque em Copiar informações.');}
   if(result.kind==='copied')toast('Informações copiadas.','success');
  }catch{if(epoch===(state.sessionEpoch||0))toast('Não foi possível copiar. Tente novamente.','error');}
  finally{if(epoch===(state.sessionEpoch||0)){state.sharePending=false;render();}}
  return;
 }
 if(action==='whatsapp'){const c=state.contacts.find(x=>x.id===btn.dataset.id);if(c&&!store.demo&&whatsappUrl(c))window.open(whatsappUrl(c),'_blank','noopener,noreferrer');return;}
 if(action==='new'||action==='edit'){if(!userIsAdmin())return;state.modal=action==='new'?'new':btn.dataset.id;render();return;}
 if(action==='close-modal'){if(state.reportPending)return;if(state.modal?.startsWith('report:')||state.modal?.startsWith('review:')){closeReportModal();return;}if(e.target!==btn&&e.target.classList.contains('modal-card'))return;state.modal=null;render();return;}
 if(action==='logout'){
  state.signingOut=true;
  clearPrivateState();state.connection='online';render();
  try{await store.signOut();}catch{toast('Saída local concluída. A revogação no servidor depende da conexão.','error');}finally{state.signingOut=false;}return;
 }
 if(action==='publish'){
  if(!userIsAdmin()||!state.upload||state.busy)return;
  const data=state.upload,diff=importPreview(state.contacts,data.valid,state.importMode);
  if(data.warnings?.length&&!data.reviewed){toast('Confira e marque a leitura dos avisos antes de publicar.','error');return;}
  if(data.errors.length||diff.duplicates||!data.valid.length){toast('Corrija os dados antes de publicar.','error');return;}
  if(state.importMode==='replace_clusters'&&!confirm('ATENÇÃO: substituir todos os contatos dos clusters '+diff.clusters.join(', ')+'? Outras regionais serão preservadas.'))return;
  if(!confirm('Confirmar publicação de '+data.valid.length+' contato(s) no banco independente?'))return;
  state.busy=true;render();
  try{await store.publish(data.valid,state.importMode);state.upload=null;await refresh();toast('Importação publicada com sucesso.','success');}
  catch(err){toast('Falha na importação: '+err.message,'error');}finally{state.busy=false;}return;
 }
 if(action==='restore'){if(!userIsAdmin()||state.busy)return;
  if(!confirm('Restaurar os clusters desta importação ao estado anterior? Alterações posteriores nesses clusters serão substituídas. Os demais clusters serão preservados.'))return;
  state.busy=true;
  try{await store.restore(btn.dataset.id);await refresh();toast('Diretório restaurado.','success');}
  catch(err){toast('Falha na restauração: '+err.message,'error');}finally{state.busy=false;}return;
 }
});
root.addEventListener('keydown',event=>{
 if(!state.modal?.startsWith('report:')&&!state.modal?.startsWith('review:'))return;
 if(event.key==='Escape'&&!state.reportPending){event.preventDefault();closeReportModal();return;}
 if(event.key!=='Tab')return;
 const fields=Array.from(root.querySelectorAll('.report-dialog button:not(:disabled),.report-dialog input,.report-dialog select,.report-dialog textarea'));
 const first=fields[0],last=fields.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
});
const recoverSession=createSessionRecovery({
 session:()=>state.signingOut?Promise.resolve(null):store.demo?Promise.resolve({id:'demo',role:'viewer',active:true}):store.session(),
 epoch:()=>state.sessionEpoch||0,
 online:()=>navigator.onLine!==false,
 checking:()=>{captureDraft();state.connection='checking';render();},
 unavailable:()=>{captureDraft();state.connection='unavailable';state.loading=false;render();},
 signedOut:async user=>{clearPrivateState();state.user=user;state.connection='online';state.loading=false;render();},
 verified:async(user,{reload})=>{
  const changed=state.user?.id!==user.id,roleChanged=state.user?.role!==user.role;
  const needsData=reload||changed||roleChanged||state.connection!=='online';
  if(roleChanged&&state.user){state.sessionEpoch=(state.sessionEpoch||0)+1;state.contacts=[];state.accounts=[];state.pendingRoster=[];state.credentials=[];state.upload=null;state.modal=null;state.batches=[];state.audit=[];state.reports=[];state.reportsLoading=false;state.reportsError='';state.reportPending=false;state.reportDraft=null;state.reviewDraft=null;state.modalReturn=null;state.sharePending=false;state.view='consultar';}
  if(!store.demo)state.user=user;
  if(changed){loadPreferences();if(!store.demo)restoreConsultation();}
  if(needsData)await refresh();
  state.connection=document.visibilityState==='hidden'&&mobile()?'checking':'online';state.loading=false;if(needsData)render();
 }
});
init();
setupPwa({canUpdate:()=>!state.busy&&!state.modal&&!state.upload,notify:message=>toast(message)});
window.addEventListener('hashchange',()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('setup');
 if(token){state.setupToken=token;history.replaceState(null,'',location.pathname+location.search);render();}
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'){captureDraft();rememberConsultation();if(mobile()){state.connection='checking';render();}}
 else if(!store.configurationError)recoverSession({quiet:!mobile()&&state.connection==='online'&&Boolean(state.user?.active),reload:mobile()});
});
window.addEventListener('pageshow',event=>{if(event.persisted)recoverSession({reload:true});});
window.addEventListener('offline',()=>{captureDraft();state.connection='unavailable';render();});
window.addEventListener('online',()=>recoverSession({reload:true}));
matchMedia('(max-width: 760px)').addEventListener('change',()=>{state.mobileMenu=false;if(!root.querySelector('#loginForm'))render();});
setInterval(()=>{if(!state.busy&&state.user&&document.visibilityState!=='hidden')recoverSession({quiet:true});},30000);
