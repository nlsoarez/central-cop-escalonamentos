// Deterministic brand glyph drawn from geometry; no external assets or packages.
import {deflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
const polygon=[[282,96],[144,284],[230,284],[210,416],[368,222],[274,222]];
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(name,data){const type=Buffer.from(name),content=Buffer.concat([type,data]);let crc=0xffffffff;for(const byte of content)crc=crcTable[(crc^byte)&255]^(crc>>>8);const size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([size,content,sum]);}
function inside(x,y){let found=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)found=!found;}return found;}
function png(size){
 const raw=Buffer.alloc((size*3+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let coverage=0;for(const dy of [.25,.75])for(const dx of [.25,.75])if(inside((x+dx)*512/size,(y+dy)*512/size))coverage++;
  const fraction=coverage/4,offset=y*(size*3+1)+1+x*3;
  [218,41,28].forEach((v,k)=>raw[offset+k]=Math.round(v+(255-v)*fraction));
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const[name,size]of[['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180]])await writeFile(new URL('../assets/'+name,import.meta.url),png(size));
console.log('PWA icons: 192, 512, maskable 512 and Apple 180.');
