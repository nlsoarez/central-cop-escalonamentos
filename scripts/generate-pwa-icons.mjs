// Resize the approved transparent cutout and preserve its alpha channel.
// Optional COP_SHARP_MODULE points to a Sharp installation outside this project.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const sharp=require(process.env.COP_SHARP_MODULE||'sharp');
const source=fileURLToPath(new URL('../assets/central-cop-official.png',import.meta.url));
for(const [name,size]of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180],['favicon-32.png',32],['favicon-48.png',48]]){
 await sharp(source).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(fileURLToPath(new URL('../assets/'+name,import.meta.url)));
}
// All variants retain the supplied artwork without added borders or padding.
console.log('Official Central COP icons generated: favicon 32/48, PWA 192/512, maskable 512, Apple 180.');
