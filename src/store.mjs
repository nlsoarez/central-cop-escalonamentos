import { CLUSTERS } from './core.mjs';

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
const client=(configured && window.supabase?.createClient)
  ? window.supabase.createClient(setting.supabaseUrl,setting.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}})
  : null;
const expect = ({data,error}) => {if(error)throw error;return data;};
export const store={
  configured:Boolean(client),
  demo:!client,
  demoContacts:DEMO_CONTACTS.map(c=>({...c})),
  async session(){
    if(!client)return null;
    const {data,error}=await client.auth.getUser();if(error||!data.user)return null;
    const profile=expect(await client.from('cop_profiles').select('id,display_name,role,active').eq('id',data.user.id).maybeSingle());
    if(!profile?.active) return {id:data.user.id,email:data.user.email,role:'pending',display_name:data.user.email,active:false};
    return {...profile,email:data.user.email};
  },
  async signIn(email,password){
    if(!client)throw Error('Configure um Supabase independente para ativar o login.');
    expect(await client.auth.signInWithPassword({email,password}));
    return this.session();
  },
  async signOut(){if(client)expect(await client.auth.signOut());},
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
