import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {encrypt,decrypt} from '../deploy/backup.mjs';
test('backup autenticado restaura bytes exatos e rejeita adulteração',async()=>{
 const directory=await fs.mkdtemp(join(tmpdir(),'cop-backup-'));
 try{
  const key=randomBytes(32),payload=randomBytes(20000),backup=join(directory,'test.enc'),output=join(directory,'restored');
  await encrypt(Readable.from(payload),backup,key);await decrypt(backup,output,key);
  assert.deepEqual(await fs.readFile(output),payload);
  const bytes=await fs.readFile(backup);bytes[100]^=1;await fs.writeFile(backup,bytes);
  await assert.rejects(decrypt(backup,join(directory,'tampered'),key));
  await assert.rejects(fs.stat(join(directory,'tampered')),/ENOENT/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
