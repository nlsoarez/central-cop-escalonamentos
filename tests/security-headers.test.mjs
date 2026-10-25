import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('CSP limita execução e destinos sem permitir handlers inline ou frames',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 const headers=Object.fromEntries(config.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key,h.value]));
 const policy=Object.fromEntries(headers['Content-Security-Policy'].split(';').map(p=>p.trim().split(/\s+/)).filter(p=>p[0]).map(([name,...values])=>[name,values]));
 assert.deepEqual(policy['default-src'],["'none'"]);
 assert.deepEqual(policy['script-src-attr'],["'none'"]);
 assert.deepEqual(policy['frame-ancestors'],["'none'"]);
 assert.deepEqual(policy['base-uri'],["'none'"]);
 assert.deepEqual(policy['object-src'],["'none'"]);
 assert.deepEqual(policy['worker-src'],["'self'"]);
 assert.deepEqual(policy['manifest-src'],["'self'"]);
 assert.ok(!policy['script-src'].some(s=>['*',"'unsafe-inline'","'unsafe-eval'",'https:','data:'].includes(s)));
 assert.deepEqual(policy['connect-src'],["'self'",'https://api-central-cop.179-198-124-8.sslip.io']);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/\son\w+\s*=/i);
 for(const match of html.matchAll(/<script\b[^>]*src="(https:[^"]+)"[^>]*>/g)){
  assert.ok(policy['script-src'].includes(match[1]),'dependência precisa estar na lista explícita da CSP');
  assert.match(match[0],/integrity="sha384-[^"]+"/);
 }
});
