// Apply the local appearance preference before the stylesheet paints the page.
(()=>{let theme='light';try{if(localStorage.getItem('cop-theme')==='dark')theme='dark';}catch{}
 document.documentElement.dataset.theme=theme;
})();
