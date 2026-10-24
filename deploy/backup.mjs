// Envelope AES-256-GCM: CCB1 + nonce de 12 bytes + ciphertext + tag de 16 bytes.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve} from 'node:path';
export async function encrypt(input,output,key){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
 const file=fs.createWriteStream(output,{flags:'wx',mode:0o600});
 file.write(Buffer.concat([Buffer.from('CCB1'),nonce]));
 try{await pipeline(input,cipher,file,{end:false});file.end(cipher.getAuthTag());await new Promise((r,j)=>{file.on('finish',r);file.on('error',j);});}
 catch(error){file.destroy();fs.rmSync(output,{force:true});throw error;}
}
export async function decrypt(inputPath,output,key){
 const size=fs.statSync(inputPath).size;if(size<32)throw Error('Invalid backup');
 const handle=fs.openSync(inputPath,'r');const header=Buffer.alloc(16),tag=Buffer.alloc(16);
 fs.readSync(handle,header,0,16,0);fs.readSync(handle,tag,0,16,size-16);fs.closeSync(handle);
 if(header.subarray(0,4).toString()!=='CCB1')throw Error('Invalid backup');
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(4));decipher.setAuthTag(tag);
 try{await pipeline(fs.createReadStream(inputPath,{start:16,end:size-17}),decipher,fs.createWriteStream(output,{flags:'wx',mode:0o600}));}
 catch(error){fs.rmSync(output,{force:true});throw error;}
}
if(process.argv[2]){
 const mode=process.argv[2],name=process.argv[3];
 if(!/^[a-zA-Z0-9_.-]+$/.test(name||''))throw Error('Invalid filename');
 const key=fs.readFileSync('/run/secrets/cop-backup-key');if(key.length!==32)throw Error('Invalid encryption key');
 const path=resolve('/backups',name);
 if(mode==='encrypt')await encrypt(process.stdin,path,key);
 else if(mode==='decrypt')await decrypt(path,path+'.verified',key);
 else throw Error('Invalid operation');
}
