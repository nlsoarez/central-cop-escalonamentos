export const MAX_URL='https://max.niceincontact.com/index.html';
export function maxWindowFeatures(screen={}){
 const availableWidth=Number(screen.availWidth)||1280,availableHeight=Number(screen.availHeight)||900;
 const width=Math.min(360,availableWidth),height=Math.min(820,availableHeight);
 const left=(Number(screen.availLeft)||0)+Math.max(0,availableWidth-width-24),top=Number(screen.availTop)||0;
 return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,noopener,noreferrer`;
}
export function openMaxWindow(win=window){win.open(MAX_URL,'central-cop-max',maxWindowFeatures(win.screen));}
