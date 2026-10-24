import {CLUSTERS,normalizeText,normalizePhone,whatsappUrl,parseCsv,filterContacts,importPreview,isCurrentValidity,topologyValues,consultationContacts} from './core.mjs';
import {parseWorkbook} from './workbook.mjs';
import {store} from './store.mjs';
import {parseRoster} from './users.mjs';

const root=document.getElementById('app');
const initialSetupToken=new URLSearchParams(location.hash.slice(1)).get('setup')||'';
if(initialSetupToken)history.replaceState(null,'',location.pathname+location.search);
const DEMO_BANNER='Demonstração com contatos fictícios. Não utilize para acionamentos.';
const iconPaths={
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
const h=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const userIsAdmin=()=>state.user?.active&&!state.user?.must_change_password&&state.user?.role==='admin';
const storage=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const setStorage=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));}catch{}};
const state={setupToken:initialSetupToken,pendingRoster:[],user:null,loading:true,contacts:[],view:'consultar',filters:{cluster:'',area:'',cidade:'',topologia:'',cargo:'',nivel:'',query:''},favorites:[],recent:[],upload:null,importMode:'merge',batches:[],accounts:[],roster:null,rosterRaw:'',credentials:[],modal:null,notice:'',busy:false};
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
  return ({consultar:'Consulta de escalonamentos',diretorio:'Diretório de contatos',favoritos:'Meus favoritos',recentes:'Consultas recentes',administracao:'Administração',importar:'Importação de planilhas',usuarios:'Gestão de usuários',nice:'Integração NICE MAX'})[state.view]||'Central COP';
}
function uiHeader(){
 const stamp=state.contacts.map(c=>c.updated_at||'').filter(Boolean).sort().at(-1);
 const date=stamp?new Date(stamp).toLocaleString('pt-BR'):'Ainda sem atualização';
 const records=state.contacts.filter(c=>c.active!==false).length.toLocaleString('pt-BR');
 return '<header class="topbar"><div class="brand-mini">'+ic('bolt',20)+'<strong>Central COP</strong><span>/ Operação de rede</span></div><div class="top-actions"><span class="status-pill '+(store.demo?'demo':'live')+'"><i></i>'+(store.demo?'Demonstração':'Base conectada')+'</span><div class="avatar" title="'+h(state.user?.email||'Modo demonstração')+'">'+h((state.user?.display_name||'COP').slice(0,2).toUpperCase())+'</div><span class="user-name">'+h(state.user?.display_name||'Demonstração')+'</span>'+(store.configured?'<button class="btn subtle account-password" data-action="change-password">Alterar senha</button><button class="icon-btn" data-action="logout" title="Sair" aria-label="Sair da conta">'+ic('logout')+'</button>':'')+'</div></header>'+
 '<section class="hero"><div class="hero-copy"><div class="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>Central COP</h1><div class="hero-subtitle">ESCALONAMENTOS</div><p>Gestão e consulta de escalonamentos operacionais.</p><span class="hero-data">'+ic('clock',13)+' Atualização: '+h(date)+'</span></div><div class="hero-summary" aria-label="Resumo do diretório"><div><span>Regiões atendidas</span><strong>'+String(CLUSTERS.length).padStart(2,'0')+'</strong></div><div><span>Registros na base</span><strong>'+records+'</strong></div></div></section>';
}
function renderShell(){
 const nav=navButton('consultar','Consultar','search')+navButton('diretorio','Diretório de contatos','users')+navButton('favoritos','Favoritos','star')+navButton('recentes','Recentes','clock')+
 '<div class="nav-divider"></div>'+navButton('nice','NICE MAX','phone')+
 (userIsAdmin()?'<div class="nav-divider"></div>'+navButton('administracao','Administração','settings')+navButton('importar','Importar planilha','upload')+navButton('usuarios','Usuários e senhas','users'):'');
 return '<div class="layout"><aside class="sidebar"><div class="sidebar-brand"><div class="logo">'+ic('bolt',27)+'</div><div><strong>Central COP</strong><small>OPERAÇÃO DE REDE</small></div></div><div class="nav-caption">NAVEGAÇÃO</div><nav aria-label="Menu principal">'+nav+'</nav><div class="sidebar-foot">'+ic('info')+'<span>Ambiente interno<small>Central de Operações</small></span></div></aside><div class="main-area">'+uiHeader()+'<main class="content">'+(store.demo?'<div class="demo-banner">'+ic('alert')+' '+DEMO_BANNER+'</div>':'')+'<div class="section-top"><div><p class="overline">CENTRAL DE CONSULTA</p><h2>'+h(topTitle())+'</h2></div><span class="muted-caption">'+state.contacts.filter(c=>c.active!==false).length+' contato(s) ativo(s)</span></div>'+renderPage()+'</main></div></div>'+
 (state.notice?'<div class="toast '+h(state.notice.kind)+'" role="status">'+h(state.notice.message)+'</div>':'')+(state.modal?renderModal():'');
}
function clusterBar(){
 const labels={RJ:'Rio de Janeiro',ES:'Espírito Santo',MG:'Minas Gerais',CO:'Centro-Oeste',NE:'Nordeste',NO:'Norte',BA:'Bahia / Sergipe'};
 return '<div class="clusters" aria-label="Regiões">'+CLUSTERS.map(c=>'<button type="button" data-action="cluster" data-cluster="'+c+'" aria-pressed="'+(state.filters.cluster===c)+'" aria-expanded="'+(state.filters.cluster===c)+'" aria-controls="region-subgroups" class="cluster '+(state.filters.cluster===c?'selected':'')+'"><span class="cluster-symbol">'+ic('map',20)+'</span><span><strong>'+c+'</strong><small>'+labels[c]+'</small></span></button>').join('')+'</div>';
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
 const button=(area,label)=>'<button type="button" data-action="subgroup" data-area="'+h(area)+'" aria-pressed="'+(state.filters.area===area)+'" class="subgroup-button '+(state.filters.area===area?'selected':'')+(!area?' all':'')+'">'+h(label)+'</button>';
 return '<section id="region-subgroups" class="region-subgroups" aria-label="Subgrupos da região '+h(state.filters.cluster)+'"><div class="subgroup-heading"><strong>Subgrupos de '+h(state.filters.cluster)+'</strong><span>Selecione uma área para refinar a consulta.</span></div>'+(areas.length?'<div class="subgroup-options" role="group" aria-label="Selecionar subgrupo">'+button('','Todos os subgrupos')+areas.map(a=>button(a,a)).join('')+'</div>':'<p class="panel-hint">Não há subgrupos cadastrados nesta região.</p>')+'</section>';
}
function filterUI(){
 const selected=Boolean(state.filters.cluster);
 const search=selected?'<div class="refine-search"><form id="searchForm" class="search-row"><label class="search-wrap">'+ic('search',20)+'<input id="mainSearch" name="query" type="search" autocomplete="off" placeholder="Buscar nome, cidade, cargo ou topologia" value="'+h(state.filters.query)+'" aria-label="Pesquisar contatos"/></label><button type="submit" class="btn primary">'+ic('search',18)+' Buscar</button></form><div class="filter-grid subgroup-filters">'+optionList('cidade','Cidade / Localidade')+optionList('topologia','Topologia')+optionList('cargo','Cargo')+optionList('nivel','Nível')+'<button type="button" class="btn clear-btn" data-action="clear">'+ic('refresh',15)+' Limpar filtros</button></div></div>':'';
 return '<section class="filter-card"><div class="filter-intro"><div><h3>Região de atendimento</h3><p>Selecione uma região para encontrar os responsáveis.</p></div><span class="selection-hint">'+(selected?h(state.filters.cluster)+' selecionada':'Nenhuma selecionada')+'</span></div>'+clusterBar()+subgroupBar()+search+'</section>';
}
function contactCard(c){
 const validNumber=normalizePhone(c.phone_e164||c.phone_display||'');
 const url=whatsappUrl(c),isFav=state.favorites.includes(c.id);
 const phone=(!store.demo&&validNumber.valid)
 ? '<a class="phone-link" href="'+url+'" target="_blank" rel="noopener noreferrer" data-contact="'+h(c.id)+'">'+ic('phone',16)+' '+h(validNumber.display)+'</a>'
 : '<span class="phone-disabled" title="'+(store.demo?'Demonstração: chamadas desativadas':'Telefone inválido')+'">'+ic('phone',16)+' '+h(c.phone_display||'Sem telefone válido')+'</span>';
 const isValid=isCurrentValidity(c);
 return '<article class="contact-card"><div class="level-block level-'+h(String(c.nivel||'other').match(/\d/)?.[0]||'other')+'"><strong>'+(c.nivel?'Nível '+h(c.nivel):'Sem nível')+'</strong><small>'+h(c.scope==='regional'?'Contato regional':'Contato local')+'</small></div><div class="contact-person"><div class="person-avatar">'+ic('users',22)+'</div><div class="person-details"><h3>'+h(c.full_name)+'</h3><div class="role">'+h(c.cargo||'Cargo não informado')+'</div><div class="dim">Área: '+h(c.area||'Toda a regional')+' · '+h(c.cluster)+(c.cidade?' · '+h(c.cidade):'')+'</div><div class="tags"><span class="tag">'+h(c.topologia||'Todas as topologias')+'</span>'+(c.scope==='regional'?'<span class="tag blue">Abrangência regional</span>':'')+(!isValid?'<span class="tag warn">Fora da vigência informada</span>':'')+(c.active===false?'<span class="tag warn">Inativo</span>':'')+'</div></div></div><div class="contact-meta">'+phone+(c.notes?'<div class="notes">'+ic('info',14)+' '+h(c.notes)+'</div>':'')+'</div><div class="contact-actions"><button class="icon-btn favorite '+(isFav?'selected':'')+'" data-action="favorite" data-id="'+h(c.id)+'" title="'+(isFav?'Remover favorito':'Adicionar favorito')+'">'+ic('star',18)+'</button><button class="btn whatsapp" '+(store.demo||!url?'disabled title="Indisponível em demonstração ou com número inválido"':'data-action="whatsapp" data-id="'+h(c.id)+'"')+'>'+ic('phone',15)+' WhatsApp</button><button class="btn subtle" data-action="copy" data-id="'+h(c.id)+'">'+ic('copy',15)+' Copiar</button><button class="btn max" disabled title="Integração NICE MAX pendente de homologação">'+ic('phone',15)+' MAX</button>'+(userIsAdmin()?'<button class="icon-btn" data-action="edit" data-id="'+h(c.id)+'" title="Editar contato">'+ic('edit')+'</button>':'')+'</div></article>';
}
function contactList(list){
 if(!list.length)return '<div class="empty"><div class="empty-icon">'+ic('search',32)+'</div><h3>Nenhum contato encontrado</h3><p>Revise os filtros ou confirme se há contatos cadastrados nessa região.</p><button class="btn subtle" data-action="clear">Limpar filtros</button></div>';
 return '<div class="result-caption"><strong>'+list.length+' contato(s) encontrado(s)</strong><span>Ordenados por nível de escalonamento</span></div><div class="contacts">'+list.map(contactCard).join('')+'</div>';
}
function rightPanel(){
 const fav=state.favorites.map(id=>state.contacts.find(c=>c.id===id)).filter(Boolean).slice(0,4);
 const recent=state.recent.slice(0,5);
 return '<aside class="side-panels"><section class="panel"><h3>'+ic('bolt')+' Acesso rápido</h3><div class="quick-grid"><button data-action="quick" data-mode="city">'+ic('map')+' Localidades</button><button data-action="quick" data-mode="topology">'+ic('layout')+' Topologias</button><button data-action="nav" data-page="diretorio">'+ic('users')+' Diretório</button><button data-action="nav" data-page="favoritos">'+ic('star')+' Favoritos</button></div></section><section class="panel"><h3>'+ic('star')+' Favoritos <button data-action="nav" data-page="favoritos">Ver todos</button></h3>'+(fav.length?fav.map(c=>'<div class="mini-row"><span class="mini-avatar">'+ic('users',16)+'</span><div><strong>'+h(c.full_name)+'</strong><small>'+h(c.cluster)+' · '+h(c.cidade||'Regional')+'</small></div><button data-action="jump" data-id="'+h(c.id)+'" title="Localizar">'+ic('chevron')+'</button></div>').join(''):'<p class="panel-hint">Marque a estrela de um contato para acessá-lo rapidamente.</p>')+'</section><section class="panel"><h3>'+ic('clock')+' Recentes</h3>'+(recent.length?recent.map(item=>'<div class="mini-row"><span class="mini-avatar">'+ic('search',16)+'</span><div><strong>'+h(item.label)+'</strong><small>'+h(item.time)+'</small></div><button data-action="recent" data-query="'+h(item.query)+'" data-cluster="'+h(item.cluster||'')+'" title="Pesquisar novamente">'+ic('chevron')+'</button></div>').join(''):'<p class="panel-hint">Suas pesquisas aparecerão aqui.</p>')+'</section><section class="panel tip"><h3>'+ic('info')+' NICE MAX</h3><p>O botão de discagem permanece desativado até configuração oficial e testes autorizados com a Claro.</p><button class="small-link" data-action="nav" data-page="nice">Saiba mais →</button></section></aside>';
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
function nicePage(){return '<div class="standalone"><div class="panel integration"><div class="integration-icon">'+ic('phone',35)+'</div><div><h3>Discagem via NICE MAX</h3><p>A interface está preparada para oferecer o botão <strong>Ligar via MAX</strong> ao lado do WhatsApp. A conexão <strong>não está ativa</strong>: depende de autorização, autenticação de agente, identificação de sessão e API liberada pela administração do NICE na Claro.</p><p>Não inserimos credenciais do MAX nem simulamos chamadas. Até a homologação, utilize WhatsApp ou copie o telefone.</p><span class="tag warn">Integração pendente</span></div></div></div>';}
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
 const events={create:'Conta criada',reset:'Senha redefinida',activate:'Acesso reativado',deactivate:'Acesso bloqueado',change_password:'Senha pessoal alterada'};
 const identity=id=>state.accounts.find(u=>u.id===id)?.login_id||id;
 return '<h3 class="subheading">Histórico administrativo</h3><div class="panel"><div class="table-overflow"><table class="preview-table"><thead><tr><th>Data</th><th>Operador</th><th>Conta</th><th>Ação</th></tr></thead><tbody>'+(state.audit||[]).map(a=>'<tr><td>'+h(new Date(a.created_at).toLocaleString('pt-BR'))+'</td><td>'+h(identity(a.actor))+'</td><td>'+h(identity(a.target))+'</td><td>'+h(events[a.event]||a.event)+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function initialSetupView(){
 return '<div class="auth-screen"><div class="auth-card"><h1>Ativar administrador</h1><p>Defina a senha pessoal da conta administrativa. Este link só pode ser usado uma vez.</p><form id="initialSetupForm"><label>Nova senha pessoal<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><label>Confirme a senha<input name="confirmation" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><button class="btn primary" type="submit" '+(state.busy?'disabled':'')+'>Ativar acesso</button></form></div></div>';
}
function passwordChangeView(){
 return '<div class="auth-screen"><div class="auth-card"><div class="auth-logo">'+ic('bolt',34)+'</div><span class="overline">SENHA PESSOAL</span><h1>Altere sua senha</h1><p>Informe a senha atual e escolha uma nova senha pessoal. No primeiro acesso, esta troca é obrigatória.</p><form id="changePasswordForm"><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" required/></label><label>Nova senha pessoal (mínimo 12 caracteres)<input name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required/></label><label>Confirme a nova senha<input name="confirmation" type="password" minlength="12" autocomplete="new-password" required/></label><button class="btn primary" type="submit" '+(state.busy?'disabled':'')+'>'+(state.busy?'Atualizando...':'Alterar senha e entrar')+'</button></form><button class="btn subtle" data-action="logout">Sair da conta</button></div></div>';
}
function renderPage(){return ({consultar:consultation,diretorio:directory,favoritos:favoritesPage,recentes:recentPage,administracao:adminPage,importar:importPage,usuarios:usersPage,nice:nicePage})[state.view]?.()||consultation();}
function renderModal(){
 const c=state.modal==='new'?{}:state.contacts.find(item=>item.id===state.modal)||{};
 const textInput=(name,label,val,required='')=>'<label class="field"><span>'+label+'</span><input name="'+name+'" value="'+h(val||'')+'" '+required+'/></label>';
 const select=(name,label,values,current)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+values.map(v=>'<option '+(v===current?'selected':'')+'>'+h(v)+'</option>').join('')+'</select></label>';
 return '<div class="modal-backdrop" data-action="close-modal"><div class="modal-card" role="dialog" aria-modal="true" aria-label="Editar contato"><div class="modal-top"><h3>'+(c.id?'Editar contato':'Novo contato')+'</h3><button class="icon-btn" data-action="close-modal" aria-label="Fechar">×</button></div><form id="contactForm" class="edit-grid">'+select('cluster','Cluster',CLUSTERS,c.cluster||'RJ')+textInput('area','Área',c.area)+textInput('cidade','Cidade / Localidade',c.cidade)+textInput('topologia','Topologia',c.topologia)+textInput('full_name','Nome completo',c.full_name,'required')+textInput('cargo','Cargo',c.cargo)+textInput('nivel','Nível de escalonamento',c.nivel)+textInput('phone_e164','Telefone com DDD',c.phone_display||c.phone_e164,'required')+select('scope','Abrangência',['local','regional'],c.scope||'local')+textInput('notes','Observações',c.notes)+textInput('valid_from','Válido a partir de (AAAA-MM-DD)',c.valid_from)+textInput('valid_until','Válido até (AAAA-MM-DD)',c.valid_until)+'<label class="check-field"><input type="checkbox" name="active" '+(c.active!==false?'checked':'')+'/> Contato ativo</label><div class="modal-actions"><button type="button" class="btn subtle" data-action="close-modal">Cancelar</button><button type="submit" class="btn primary" '+(state.busy?'disabled':'')+'>Salvar contato</button></div></form></div></div>';
}
function loginView(){
 return '<div class="auth-screen"><div class="auth-card"><div class="auth-logo">'+ic('bolt',36)+'</div><span class="overline">CENTRAL COP</span><h1>Escalonamentos</h1><p>Entre com seu acesso autorizado para consultar contatos internos.</p><form id="loginForm"><label>Matrícula ou e-mail de administrador<input type="text" name="email" required autocomplete="username"/></label><label>Senha<input type="password" name="password" required autocomplete="current-password"/></label><button class="btn primary" type="submit">Entrar</button></form><small>Cadastro restrito. Solicite acesso ao administrador do portal.</small></div></div>';
}
function clearPrivateState(){
 state.sessionEpoch=(state.sessionEpoch||0)+1;
 state.pendingRoster=[];state.user=null;state.contacts=[];state.accounts=[];state.batches=[];state.audit=[];state.upload=null;
 state.credentials=[];state.roster=null;state.rosterRaw='';state.modal=null;state.view='consultar';
 state.recent=[];state.favorites=[];
}
const authNotice=()=>state.notice?'<div class="toast '+h(state.notice.kind)+'" role="status">'+h(state.notice.message)+'</div>':'';
function render(){
 if(store.configurationError){root.innerHTML='<div class="auth-screen"><div class="auth-card"><h1>Serviço indisponível</h1><p>'+h(store.configurationError)+'</p></div></div>';return;}
 if(state.setupToken){root.innerHTML=initialSetupView()+authNotice();return;}
 if(state.loading){root.innerHTML='<div class="loading">'+ic('refresh',34)+' Carregando Central COP...</div>';return;}
 if(store.configured && state.user?.active && (state.user.must_change_password||state.view==='senha')){root.innerHTML=passwordChangeView()+authNotice();return;}
 if(store.configured && !state.user?.active){root.innerHTML=state.user?.role==='pending'?'<div class="auth-screen"><div class="auth-card"><h2>Acesso pendente</h2><p>Seu usuário ainda não foi liberado. Procure o administrador.</p><button class="btn primary" data-action="logout">Sair</button></div></div>':loginView();root.insertAdjacentHTML('beforeend',authNotice());return;}
 root.innerHTML=renderShell();
}
async function refresh(){
 state.contacts=await store.contacts();
 if(userIsAdmin()){
   const [batches,accounts,audit,pending]=await Promise.all([store.batches(),store.users(),store.userAudit(),store.pendingRoster()]);
   state.batches=batches;state.accounts=accounts;state.audit=audit;state.pendingRoster=pending;
 }
 render();
}
async function init(){
 try{state.user=await store.session();loadPreferences();if(store.demo||(state.user?.active&&!state.user.must_change_password))await refresh();}
 catch(e){state.notice={message:'Falha ao carregar dados: '+e.message,kind:'error'};}
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
  e.preventDefault();const f=new FormData(e.target);
  try{state.user=await store.signIn(String(f.get('email')),String(f.get('password')));}
  catch(error){toast(['session','network'].includes(error.stage)?error.message:'Não foi possível entrar. Confira matrícula e senha ou procure o administrador.','error');return;}
  loadPreferences();
  try{if(state.user?.active&&!state.user.must_change_password)await refresh();else render();}
  catch{render();toast('Login confirmado, mas não foi possível carregar os dados. Recarregue a página para tentar novamente.','error');}
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
 if(action==='change-password'){state.credentials=[];state.view='senha';render();return;}
 if(action==='nav'){
  if(state.view==='usuarios'&&btn.dataset.page!=='usuarios'){
    state.credentials=[];state.roster=null;state.rosterRaw='';
  }
  state.view=btn.dataset.page;render();return;
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
 if(action==='whatsapp'){const c=state.contacts.find(x=>x.id===btn.dataset.id);if(c&&!store.demo&&whatsappUrl(c))window.open(whatsappUrl(c),'_blank','noopener,noreferrer');return;}
 if(action==='new'||action==='edit'){if(!userIsAdmin())return;state.modal=action==='new'?'new':btn.dataset.id;render();return;}
 if(action==='close-modal'){if(e.target!==btn&&e.target.classList.contains('modal-card'))return;state.modal=null;render();return;}
 if(action==='logout'){
  try{await store.signOut();}finally{
   clearPrivateState();
   render();
  }return;
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
init();
window.addEventListener('hashchange',()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('setup');
 if(token){state.setupToken=token;history.replaceState(null,'',location.pathname+location.search);render();}
});
if(store.configured&&!store.configurationError){
 let checking=false;
 setInterval(async()=>{
  if(checking||state.busy||!state.user)return;
  checking=true;
  try{
   const user=await store.session();
   if(!user?.active||user.must_change_password){clearPrivateState();state.user=user;render();}
   else if(user.role!==state.user.role){clearPrivateState();state.user=user;await refresh();}
   else state.user=user;
  }catch{clearPrivateState();render();}
  finally{checking=false;}
 },30000);
}
