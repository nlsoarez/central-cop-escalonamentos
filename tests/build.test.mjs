import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build,publicConfig,PUBLIC_FILES} from '../scripts/build.mjs';
test('build publica somente a interface e configuração pública',async()=>{
 const output=await mkdtemp(join(tmpdir(),'cop-build-'));
 try{
  await build(output,{});
  const files=await readdir(output,{recursive:true});
  assert.deepEqual(files.filter(p=>p.includes('.')).map(p=>p.replaceAll('\\','/')).sort(),[...PUBLIC_FILES,'config.js'].sort());
  assert.ok(!(await readFile(join(output,'config.js'),'utf8')).includes('service_role'));
  await writeFile(join(output,'private.csv'),'synthetic');
  await assert.rejects(build(output,{}),/não autorizados/);
 }finally{await rm(output,{recursive:true,force:true});}
});
test('build rejeita chaves privadas e configuração incompleta',()=>{
 for(const key of ['sb_secret_synthetic','header.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.signature']){
  assert.throws(()=>publicConfig({COP_SUPABASE_URL:'https://test.invalid',COP_SUPABASE_ANON_KEY:key}),/Somente chave/);
 }
 assert.throws(()=>publicConfig({COP_SUPABASE_URL:'https://test.invalid'}),/juntas/);
 assert.throws(()=>publicConfig({COP_SUPABASE_URL:'http://test.invalid',COP_SUPABASE_ANON_KEY:'sb_publishable_synthetic'}),/HTTPS/);
});
