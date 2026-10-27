const control=document.getElementById('monitor-enabled');
chrome.storage.local.get('monitorEnabled').then(value=>{control.checked=value.monitorEnabled===true;});
control.addEventListener('change',async()=>{
 try{await chrome.storage.local.set({monitorEnabled:control.checked});document.getElementById('status').textContent=control.checked?'Ativado. Recarregue o monitoramento.':'Desativado. A integração atual com o MAX permanece disponível.';}
 catch{document.getElementById('status').textContent='Não foi possível salvar a preferência.';}
});
