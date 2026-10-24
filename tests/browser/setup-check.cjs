async(page)=>{
 await page.unrouteAll({behavior:'wait'});
 await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.CENTRAL_COP_CONFIG={supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'public'}"}));
 await page.route('**/supabase.min.js',route=>route.fulfill({contentType:'text/javascript',body:`
 let logged=false;
 const profile={id:'synthetic-admin',role:'admin',active:true,must_change_password:false,display_name:'Administrador Sintético'};
 window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:logged?{id:profile.id,email:'admin@example.invalid'}:null}}),signInWithPassword:async()=>{logged=true;return {};},signOut:async()=>{logged=false;return {};}},
 rpc:async()=>({data:true}),functions:{invoke:async(name)=>({data:name==='cop-initial-setup'?{success:true}:{results:[{login:'F9900001',nome:'Pessoa Sintética',status:'created',temporaryPassword:'SyntheticOnly123456'}]}})},
 from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[]}),limit:async()=>({data:[]}),maybeSingle:async()=>({data:profile}),then:resolve=>Promise.resolve({data:table==='cop_pending_roster'?[{login_id:'F9900001',display_name:'Pessoa Sintética'}]:table==='cop_profiles'?[profile]:[]}).then(resolve)};return q;}})};
 `}));
 await page.route('http://127.0.0.1:8087/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/ integrity="[^"]+"/g,'')});});
 await page.goto('about:blank');
 await page.goto('http://127.0.0.1:8087/#setup='+'a'.repeat(64));
 await page.getByRole('heading',{name:'Ativar administrador'}).waitFor();
 if(new URL(page.url()).hash)throw Error('Token permaneceu no histórico do navegador');
 await page.getByLabel('Nova senha pessoal',{exact:true}).fill('SyntheticAdmin123456');
 await page.getByLabel('Confirme a senha',{exact:true}).fill('SyntheticAdmin123456');
 await page.getByRole('button',{name:'Ativar acesso',exact:true}).click();
 await page.getByRole('textbox',{name:'Matrícula ou e-mail de administrador'}).fill('ADMINTEST');
 await page.getByLabel('Senha',{exact:true}).fill('SyntheticAdmin123456');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('button',{name:'Usuários e senhas',exact:true}).click();
 await page.getByRole('button',{name:'Carregar lista dos analistas',exact:true}).click();
 await page.getByRole('button',{name:'Criar contas individuais',exact:true}).waitFor();
 // Apenas nesta página local com SDK simulado: aprovar o diálogo do cenário.
 await page.evaluate(()=>{window.confirm=()=>true;});
 await page.getByRole('button',{name:'Criar contas individuais',exact:true}).click();
 await page.getByText('SyntheticOnly123456',{exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Exportar CSV confidencial'}).count())throw Error('Exportação de senha indevida');
 await page.getByRole('button',{name:'Sair',exact:true}).click();
 if((await page.locator('body').innerText()).includes('SyntheticOnly123456'))throw Error('Senha retida após logout');
 return {activation:true,tokenRemovedFromUrl:true,privateRoster:true,credentialsTemporary:true};
}
