async (page) => {
 await page.getByRole('combobox',{name:'Cidade / Localidade',exact:true}).selectOption('Nova Iguaçu');
 const regional=await page.getByRole('article').count();
 if(regional!==3)throw Error('Regional oculto pelo filtro de cidade');
 await page.getByRole('button',{name:'MG Minas Gerais',exact:true}).click();
 await page.getByRole('searchbox',{name:'Pesquisar contatos'}).fill('coordenacao');
 await page.getByRole('button',{name:'Buscar',exact:true}).click();
 if(await page.getByRole('article').count()!==1)throw Error('Pesquisa sem acentos falhou');
 await page.getByRole('button',{name:'Adicionar favorito',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Favoritos',exact:true}).click();
 if(await page.getByRole('article').count()!==1)throw Error('Favorito não salvo');
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('Rolagem horizontal na tela de 390px');
 await page.screenshot({path:'output/playwright/demo-mobile.png',fullPage:true});
 return {regional,accentSearch:true,favorites:true,mobileOverflow:overflow,whatsappLinks:await page.locator('a.phone-link').count()};
}
