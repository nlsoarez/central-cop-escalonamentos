import {mkdir,copyFile,writeFile,readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const PUBLIC_FILES=['index.html','config.example.js','assets/styles.css','assets/cop-noc-header.png','src/app.mjs','src/core.mjs','src/workbook.mjs','src/store.mjs','src/users.mjs','src/contact-reports.mjs','src/contact-actions.mjs','src/session-lifecycle.mjs','src/pwa.mjs','src/theme.js','src/region-maps.mjs','src/monitoring.mjs','manifest.webmanifest','sw.js','offline.html','assets/favicon-32.png','assets/favicon-48.png','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','assets/apple-touch-icon.png'];
export function publicConfig(env){
 const url=env.COP_SUPABASE_URL||'',key=env.COP_SUPABASE_ANON_KEY||'';
 if(env.VERCEL_ENV==='production'&&(!url||!key))throw Error('Publicação de produção exige URL e chave pública do backend; demonstração não pode ser publicada em produção.');
 if(Boolean(url)!==Boolean(key))throw Error('Informe URL e chave pública juntas');
 if(url&&new URL(url).protocol!=='https:')throw Error('O backend publicado exige HTTPS');
 if(key&&!key.startsWith('sb_publishable_')){
  let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{}
  if(claims?.role!=='anon')throw Error('Somente chave publishable ou JWT anon pode ir ao frontend');
 }
 return {supabaseUrl:url,supabaseAnonKey:key,firstAccessEnabled:env.COP_FIRST_ACCESS_ENABLED==='true'};
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
 const revision=createHash('sha256');
 for(const name of PUBLIC_FILES){revision.update(name);revision.update(await readFile(resolve(root,name)));}
 const worker=await readFile(resolve(root,'sw.js'),'utf8');
 await writeFile(resolve(output,'sw.js'),worker.replaceAll('__COP_BUILD__',revision.digest('hex').slice(0,16)));
 await writeFile(resolve(output,'config.js'),'window.CENTRAL_COP_CONFIG = '+JSON.stringify(config)+';\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await build(fileURLToPath(new URL('../dist/',import.meta.url)));
 console.log('Build estático: dist/ (somente arquivos públicos autorizados)');
}
