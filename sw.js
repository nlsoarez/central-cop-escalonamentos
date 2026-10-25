// Cache is deliberately limited to public, static, offline presentation assets.
// Never add config.js, app HTML, API responses, tokens, contacts or user data.
const CACHE='cop-public-static-__COP_BUILD__';
const STATIC=['/offline.html','/assets/styles.css','/assets/icon-192.png','/assets/icon-512.png','/assets/icon-maskable-512.png','/assets/apple-touch-icon.png','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('cop-public-static-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='COP_ACTIVATE_UPDATE')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization')||request.headers.has('apikey'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match('/offline.html',{cacheName:CACHE})));
  return;
 }
 if(url.search||!STATIC.includes(url.pathname))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok&&response.type!=='opaque'){
    const cache=await caches.open(CACHE);await cache.put(url.pathname,response.clone());
   }
   return response;
  }catch{return caches.match(url.pathname,{cacheName:CACHE});}
 })());
});
