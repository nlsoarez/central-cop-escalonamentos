import {mkdir,copyFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const PUBLIC_FILES=['index.html','config.example.js','assets/styles.css','src/app.mjs','src/core.mjs','src/workbook.mjs','src/store.mjs','src/users.mjs'];
export function publicConfig(env){
 const url=env.COP_SUPABASE_URL||'',key=env.COP_SUPABASE_ANON_KEY||'';
 if(Boolean(url)!==Boolean(key))throw Error('Informe URL e chave pública juntas');
 if(url&&new URL(url).protocol!=='https:')throw Error('O backend publicado exige HTTPS');
 if(key&&!key.startsWith('sb_publishable_')){
  let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{}
  if(claims?.role!=='anon')throw Error('Somente chave publishable ou JWT anon pode ir ao frontend');
 }
 return {supabaseUrl:url,supabaseAnonKey:key};
}
export async function build(output,env=process.env){
 const config=publicConfig(env);
 await mkdir(output,{recursive:true});
 const existing=await readdir(output,{recursive:true,withFileTypes:true});
 const allowed=new Set([...PUBLIC_FILES,'config.js'].map(name=>resolve(output,name)));
 if(existing.some(entry=>!entry.isDirectory()&&!allowed.has(resolve(entry.parentPath,entry.name)))){
  throw Error('A saída contém arquivos não autorizados. Use uma pasta de build limpa.');
 }
 const root=fileURLToPath(new URL('../',import.meta.url));
 for(const name of PUBLIC_FILES){
  const target=resolve(output,name);await mkdir(resolve(target,'..'),{recursive:true});
  await copyFile(resolve(root,name),target);
 }
 await writeFile(resolve(output,'config.js'),'window.CENTRAL_COP_CONFIG = '+JSON.stringify(config)+';\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await build(fileURLToPath(new URL('../dist/',import.meta.url)));
 console.log('Build estático: dist/ (somente arquivos públicos autorizados)');
}
