export function setupPwa({canUpdate=()=>true,notify=()=>{}}={}){
 const host=document.createElement('div');host.className='app-tools';host.setAttribute('aria-label','Instalação e atualização');document.body.append(host);
 let prompt,waiting;
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 function button(label,handler){const el=document.createElement('button');el.className='btn subtle';el.textContent=label;el.type='button';el.addEventListener('click',handler);return el;}
 function draw(){
  host.replaceChildren();
  if(waiting)host.append(button('Atualizar aplicativo',()=>{
   if(!canUpdate()){notify('Conclua a edição ou importação antes de atualizar.');return;}
   waiting.postMessage({type:'COP_ACTIVATE_UPDATE'});
  }));
  if(prompt&&!standalone())host.append(button('Instalar Central COP',async()=>{
   const event=prompt;prompt=null;draw();
   try{await event.prompt();await event.userChoice;}catch{notify('A instalação não foi concluída.');}
  }));
  else if(ios&&!standalone()){
   const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Instalar no iPhone/iPad';summary.className='btn subtle';
   const text=document.createElement('p');text.textContent='No Safari, abra Compartilhar e escolha Adicionar à Tela de Início. Se necessário, abra este endereço no Safari. O aplicativo instalado pode pedir um primeiro login próprio.';
   detail.append(summary,text);host.append(detail);
  }
  host.hidden=!host.childElementCount;
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;draw();});
 window.addEventListener('appinstalled',()=>{prompt=null;draw();});
 draw();
 if(!('serviceWorker' in navigator))return;
 let controlled=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)location.reload();else controlled=true;});
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
  function ready(){if(registration.waiting){waiting=registration.waiting;draw();}}
  ready();
  registration.addEventListener('updatefound',()=>{
   const worker=registration.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)ready();});
  });
  const check=()=>{if(navigator.onLine!==false)registration.update().catch(()=>{});};
  window.addEventListener('pageshow',check);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
  check();
 }).catch(()=>{ /* Portal remains usable if installation is unavailable. */ });
}
