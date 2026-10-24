async (page) => {
 await page.setViewportSize({width:1440,height:1000});
 await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.CENTRAL_COP_CONFIG={supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'public'};"}));
 await page.route('**/supabase.min.js',route=>route.fulfill({contentType:'text/javascript',body:`
 let logged=false,changed=false;
 window.supabase={createClient:()=>({
 auth:{getUser:async()=>({data:{user:logged?{id:'synthetic-viewer',email:'viewer@example.invalid'}:null}}),signOut:async()=>{logged=false;return {};},signInWithPassword:async({password})=>{if(password==='incorrect')return {error:Object.assign(Error('DO NOT DISPLAY PROVIDER DETAIL'),{status:401})};logged=true;return {data:{}};}},
 rpc:async()=>({data:true}),
 from:(table)=>{
  const q={select:()=>q,eq:()=>q,order:()=>q,
   maybeSingle:async()=>({data:{id:'synthetic-viewer',login_id:'F000001',display_name:'Pessoa Sintética',role:'viewer',active:true,must_change_password:!changed}}),
   range:async()=>({data:[{id:'contact-fixture',cluster:'RJ',full_name:'Contato de Teste Sintético',area:'Baixada',cidade:'Nova Iguaçu',cargo:'Supervisão',nivel:'1',scope:'local',active:true,phone_e164:'5555999990001',phone_display:'(55) 99999-0001'}]})};return q;},
 functions:{invoke:async()=>{changed=true;return {data:{success:true,reauthenticate:true}};}}
 })};
 `}));
 // Somente no cenário simulado: permitir substituir o SDK pela fixture.
 await page.route('http://127.0.0.1:8087/',async route=>{
  const response=await route.fetch();const html=await response.text();
  await route.fulfill({response,body:html.replace(/ integrity="[^"]+"/g,'')});
 });
 await page.goto('http://127.0.0.1:8087');
 await page.getByRole('textbox',{name:'Matrícula ou e-mail de administrador'}).fill('F000001');
 await page.getByLabel('Senha',{exact:true}).fill('incorrect');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Não foi possível entrar'}).waitFor({timeout:5000});
 if((await page.locator('body').innerText()).includes('DO NOT DISPLAY'))throw Error('Erro interno exposto');
 await page.getByLabel('Senha',{exact:true}).fill('SyntheticInitial123!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('heading',{name:'Altere sua senha',exact:true}).waitFor({timeout:5000}).catch(async error=>{throw Error(error.message+' BODY: '+await page.locator('body').innerText());});
 await page.getByLabel('Senha atual',{exact:true}).fill('SyntheticInitial123!');
 await page.getByLabel('Nova senha pessoal (mínimo 12 caracteres)',{exact:true}).fill('SyntheticChanged123!');
 await page.getByLabel('Confirme a nova senha',{exact:true}).fill('SyntheticChanged123!');
 await page.getByRole('button',{name:'Alterar senha e entrar',exact:true}).click();
 await page.getByRole('heading',{name:'Escalonamentos',exact:true}).waitFor({timeout:5000});
 await page.getByRole('textbox',{name:'Matrícula ou e-mail de administrador'}).fill('F000001');
 await page.getByLabel('Senha',{exact:true}).fill('SyntheticChanged123!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('heading',{name:'Contato de Teste Sintético',exact:true}).waitFor({timeout:5000});
 const whatsapp=await page.locator('a.phone-link').getAttribute('href');
 if(whatsapp!=='https://wa.me/5555999990001')throw Error('DDD 55 incorreto');
 if(!await page.getByRole('button',{name:'MAX',exact:true}).isDisabled())throw Error('MAX ativo');
 await page.getByRole('button',{name:'Alterar senha',exact:true}).click();
 await page.getByRole('heading',{name:'Altere sua senha',exact:true}).waitFor({timeout:5000}).catch(async error=>{throw Error(error.message+' BODY: '+await page.locator('body').innerText());});
 await page.getByRole('button',{name:'Sair da conta',exact:true}).click();
 await page.getByRole('heading',{name:'Escalonamentos',exact:true}).waitFor({timeout:5000});
 if((await page.locator('body').innerText()).includes('Contato de Teste Sintético'))throw Error('Dados permaneceram após sair');
 return {mockedAuth:true,genericLoginError:true,mandatoryPassword:true,reauthentication:true,whatsapp,voluntaryPassword:true,logoutClearsUi:true};
}
