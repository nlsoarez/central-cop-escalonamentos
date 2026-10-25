// Resize the supplied official artwork; no redraw, crop or visual alteration.
// Optional COP_SHARP_MODULE points to a Sharp installation outside this project.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const sharp=require(process.env.COP_SHARP_MODULE||'sharp');
const source=fileURLToPath(new URL('../assets/central-cop-official.png',import.meta.url));
for(const [name,size]of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180],['favicon-32.png',32],['favicon-48.png',48]]){
 await sharp(source).resize(size,size,{fit:'contain',background:'#ffffff'}).png().toFile(fileURLToPath(new URL('../assets/'+name,import.meta.url)));
}
// Keep the entire square artwork inside Android's maskable safe circle.
await sharp(source).resize(360,360).extend({top:76,bottom:76,left:76,right:76,background:'#ffffff'}).png().toFile(fileURLToPath(new URL('../assets/icon-maskable-512.png',import.meta.url)));
console.log('Official Central COP icons generated: favicon 32/48, PWA 192/512, maskable 512, Apple 180.');
