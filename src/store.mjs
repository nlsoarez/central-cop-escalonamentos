import { CLUSTERS } from './core.mjs';
import {accountAlias} from './users.mjs';

// Exemplos completamente fictícios. SEM acionamento para números de demonstração.
const DEMO_CONTACTS = [
  {id:'demo-a',cluster:'RJ',area:'Baixada Fluminense',cidade:'Nova Iguaçu',topologia:'GPON',full_name:'Contato Demonstrativo A',cargo:'Supervisão de Rede',nivel:'1',phone_display:'(21) 99999-0001',phone_e164:'5521999990001',notes:'Apenas demonstração. Não utilizar para escalonamento.',scope:'local',active:true},
  {id:'demo-b',cluster:'RJ',area:'Baixada Fluminense',cidade:'',topologia:'GPON',full_name:'Contato Demonstrativo B',cargo:'Coordenação',nivel:'2',phone_display:'(21) 99999-0002',phone_e164:'5521999990002',notes:'Contato regional fictício.',scope:'regional',active:true},
  {id:'demo-c',cluster:'RJ',area:'',cidade:'',topologia:'',full_name:'Contato Demonstrativo C',cargo:'Gerência',nivel:'3',phone_display:'(21) 99999-0003',phone_e164:'5521999990003',notes:'Exemplo de abrangência para todo o cluster.',scope:'regional',active:true},
  {id:'demo-d',cluster:'ES',area:'Grande Vitória',cidade:'Vitória',topologia:'HFC',full_name:'Contato Demonstrativo D',cargo:'Supervisão',nivel:'1',phone_display:'(27) 99999-0004',phone_e164:'5527999990004',notes:'Exemplo: Espírito Santo.',scope:'local',active:true},
  {id:'demo-e',cluster:'MG',area:'Metropolitana',cidade:'Belo Horizonte',topologia:'GPON',full_name:'Contato Demonstrativo E',cargo:'Coordenação',nivel:'2',phone_display:'(31) 99999-0005',phone_e164:'5531999990005',notes:'Exemplo: Minas Gerais.',scope:'local',active:true},
  {id:'demo-f',cluster:'CO',area:'Goiás',cidade:'Goiânia',topologia:'GPON',full_name:'Contato Demonstrativo F',cargo:'Supervisão',nivel:'1',phone_display:'(62) 99999-0006',phone_e164:'5562999990006',notes:'Exemplo: Centro-Oeste.',scope:'local',active:true},
  {id:'demo-g',cluster:'NE',area:'Pernambuco',cidade:'Recife',topologia:'HFC',full_name:'Contato Demonstrativo G',cargo:'Supervisão',nivel:'1',phone_display:'(81) 99999-0007',phone_e164:'5581999990007',notes:'Exemplo: Nordeste.',scope:'local',active:true},
  {id:'demo-h',cluster:'NO',area:'Pará',cidade:'Belém',topologia:'GPON',full_name:'Contato Demonstrativo H',cargo:'Supervisão',nivel:'1',phone_display:'(91) 99999-0008',phone_e164:'5591999990008',notes:'Exemplo: Norte.',scope:'local',active:true},
  {id:'demo-i',cluster:'BA',area:'Bahia',cidade:'Salvador',topologia:'HFC',full_name:'Contato Demonstrativo I',cargo:'Supervisão',nivel:'1',phone_display:'(71) 99999-0009',phone_e164:'5571999990009',notes:'Exemplo: Bahia.',scope:'local',active:true}
].map(c=>({...c,updated_at:'',valid_from:null,valid_until:null}));
const setting=window.CENTRAL_COP_CONFIG || {};
const configured=Boolean(setting.supabaseUrl && setting.supabaseAnonKey);
// Same storage-key convention as SupabaseClient, preserving existing sessions.
const authStorageKey=configured?'sb-'+new URL(setting.supabaseUrl).hostname.split('.')[0]+'-auth-token':'';
const client=(configured && window.supabase?.createClient)
  ? window.supabase.createClient(setting.supabaseUrl,setting.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}})
  : null;
// Falha de dependência/configuração não pode mudar um ambiente real para demo.
const configurationError = configured && !client
  ? 'Não foi possível carregar a autenticação. Recarregue ou contate o administrador.'
  : Boolean(setting.supabaseUrl) !== Boolean(setting.supabaseAnonKey)
    ? 'Configuração incompleta da autenticação. Contate o administrador.' : '';
const expect = ({data,error}) => {if(error)throw error;return data;};
const unavailable = () => Object.assign(Error('Não foi possível validar sua sessão agora. Reconecte para tentar novamente.'),{transient:true});
const terminalAuthError = error => [400,401,403].includes(error?.status) && error?.name !== 'AuthRetryableFetchError';
export const store={
  firstAccessEnabled:setting.firstAccessEnabled===true,
  configured:configured || Boolean(configurationError),
  configurationError,
  demo:!client && !configurationError,
  demoContacts:DEMO_CONTACTS.map(c=>({...c})),
  async session(){
    if(!client)return null;
    // getSession recovers persisted state and lets the SDK refresh expired access
    // tokens under its own lock. It is never used as authorization evidence.
    if(client.auth.getSession){
      const restored=await client.auth.getSession();
      if(restored.error){if(terminalAuthError(restored.error))return null;throw unavailable();}
      if(!restored.data?.session)return null;
    }
    const {data,error}=await client.auth.getUser();
    if(error){if(terminalAuthError(error)){await client.auth.signOut({scope:'local'});return null;}throw unavailable();}
    if(!data?.user)return null;
    const validation=await client.rpc('cop_session_valid');
    if(validation.error)throw unavailable();
    const valid=validation.data;
    if(typeof valid!=='boolean')throw unavailable();
    if(!valid){await client.auth.signOut({scope:'local'});return null;}
    const profile=expect(await client.from('cop_profiles').select('id,login_id,display_name,role,active,must_change_password').eq('id',data.user.id).maybeSingle());
    if(!profile?.active) return {id:data.user.id,email:data.user.email,role:'pending',display_name:data.user.email,active:false};
    return {...profile,email:data.user.email};
  },
  async signIn(identifier,password){
    if(!client)throw Error('Configure um Supabase independente para ativar o login.');
    const value=String(identifier||'').trim();
    const email=value.includes('@') ? value.toLowerCase() : accountAlias(value);
    // Alias interno na autenticação; senhas nunca são mantidas no navegador pelo portal.
    const result=await client.auth.signInWithPassword({email,password});
    if(result.error){
      const status=result.error.status;
      if(status===429)throw Object.assign(Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'),{stage:'network'});
      if(![400,401,422].includes(status))throw Object.assign(Error('Não foi possível conectar ao serviço de acesso. Tente novamente em instantes.'),{stage:'network'});
      throw result.error;
    }
    try{return await this.session();}
    catch(cause){throw Object.assign(Error('Sua senha foi aceita, mas não foi possível validar a sessão. Tente novamente em instantes.'),{stage:'session',cause});}
  },
  async invoke(name,body){
    if(!client)throw Error('Banco independente ainda não configurado.');
    const {data,error}=await client.functions.invoke(name,{body});
    if(error){
      let detail='';
      try{detail=(await error.context?.json())?.error||'';}catch{}
      throw Error(detail||error.message||'Falha no serviço.');
    }
    if(data?.error)throw Error(data.error);
    return data;
  },
  async changePassword(currentPassword,newPassword){
    return this.invoke('cop-change-password',{currentPassword,newPassword});
  },
  async initialSetup(token,password){return this.invoke('cop-initial-setup',{token,password});},
  async requestFirstAccess(login){return this.invoke('cop-first-access',{action:'request',login});},
  async activateFirstAccess(token,password){return this.invoke('cop-first-access',{action:'activate',token,password});},
  async pendingRoster(){
    if(!client)return [];
    return expect(await client.from('cop_pending_roster').select('login_id,display_name').order('login_id'));
  },
  async users(){
    if(!client)return [];
    return expect(await client.from('cop_profiles')
      .select('id,login_id,display_name,role,active,must_change_password')
      .order('display_name',{ascending:true}));
  },
  async userAudit(){
    if(!client)return [];
    return expect(await client.from('cop_user_audit').select('id,actor,target,event,created_at').order('created_at',{ascending:false}).limit(100));
  },
  async reports(){
    if(!client)return [];
    return expect(await client.from('cop_contact_reports').select('id,contact_id,contact_name,contact_cluster,contact_area,contact_city,reporter_id,reason,message,status,review_note,created_at,reviewed_at').order('status').order('created_at',{ascending:false}).limit(200));
  },
  async submitContactReport(contactId,reason,message){
    if(!client)throw Error('Relatos indisponíveis na demonstração.');
    return expect(await client.rpc('cop_submit_contact_report',{p_contact_id:contactId,p_reason:reason,p_message:message}));
  },
  async reviewContactReport(reportId,note){
    if(!client)throw Error('Relatos indisponíveis na demonstração.');
    return expect(await client.rpc('cop_review_contact_report',{p_report_id:reportId,p_note:note}));
  },
  async createUsers(users,onProgress=()=>{}){
    const results=[];
    for(let i=0;i<users.length;i+=20){
      const response=await this.invoke('cop-manage-users',{action:'create',users:users.slice(i,i+20)});
      results.push(...(response.results||[]));
      onProgress([...results]);
    }
    return results;
  },
  async resetUserPassword(userId){
    return this.invoke('cop-manage-users',{action:'reset',userId});
  },
  async setUserActive(userId,active){
    return this.invoke('cop-manage-users',{action:'set_active',userId,active});
  },
  async signOut(){
    if(!client)return;
    try{expect(await client.auth.signOut());}
    finally{
      // Explicit logout is different from transport failure during validation:
      // discard this application's stored session even when the logout request
      // cannot reach the server. Never clear unrelated browser storage.
      try{for(const key of [authStorageKey,authStorageKey+'-code-verifier',authStorageKey+'-user'])window.localStorage?.removeItem(key);}catch{}
    }
  },
  async contacts(){
    if(!client)return DEMO_CONTACTS.map(c=>({...c}));
    const rows=[];
    for(let from=0;from<50000;from+=500){
      const page=expect(await client.from('cop_contacts').select('*').order('id',{ascending:true}).range(from,from+499));
      rows.push(...page);
      if(page.length<500)break;
    }
    return rows;
  },
  async saveContact(values){
    if(!client)throw Error('Modo demonstração: alterações desativadas.');
    const payload={...values};
    const id=payload.id; delete payload.updated_at;delete payload.created_at;delete payload.updated_by;
    if(id)return expect(await client.from('cop_contacts').update(payload).eq('id',id).select().single());
    delete payload.id;
    return expect(await client.from('cop_contacts').insert(payload).select().single());
  },
  async publish(items,mode){
    if(!client)throw Error('Modo demonstração: importações desativadas.');
    return expect(await client.rpc('cop_publish_contacts',{p_rows:items,p_mode:mode}));
  },
  async batches(){
    if(!client)return [];
    return expect(await client.from('cop_import_batches').select('id,created_at,mode,clusters,row_count,added,changed,removed').order('created_at',{ascending:false}).limit(20));
  },
  async restore(id){
    if(!client)throw Error('Modo demonstração: restauração desativada.');
    return expect(await client.rpc('cop_restore_import',{p_batch_id:id}));
  },
  async accountCount(){
    if(!client)return {count:0};
    return expect(await client.from('cop_profiles').select('id',{count:'exact',head:true}));
  }
};
export {CLUSTERS};
