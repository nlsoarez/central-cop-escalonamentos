(() => {
  if (location.origin !== CopMaxPolicy.max || location.pathname !== '/index.html' || window.top !== window) return;
  const ready = document.createElement('div');
  ready.textContent = 'Assistente COP ativo · 0.2.1';
  ready.style.cssText = 'position:fixed;bottom:3px;right:4px;z-index:2147483646;font:11px Arial,sans-serif;background:#fff;color:#83170f;border:1px solid #da291c;padding:3px 6px;border-radius:4px;pointer-events:none';
  document.documentElement.append(ready);
  let current = null;
  let host = null;
  let expiry = null;
  function clear() { clearTimeout(expiry); host?.remove(); host = null; current = null; }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.tab) { respond({ok: false, code: 'UNTRUSTED_SOURCE'}); return; }
    let request;
    try { request = CopMaxPolicy.request(message); } catch { respond({ok: false, code: 'INVALID_REQUEST'}); return; }
    if (current) { respond({ok: false, code: 'BUSY'}); return; }
    clear();
    current = request;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647;max-width:calc(100vw - 24px);width:350px';
    const shadow = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{font:14px Arial,sans-serif;color:#1f1d1d}section{background:white;border:2px solid #da291c;border-radius:12px;padding:16px;box-shadow:0 6px 24px #0004}h2{font-size:17px;margin:0 0 12px}strong{font-size:22px}p{line-height:1.5}button{min-height:44px;padding:10px 12px;border-radius:6px;border:1px solid #aaa;background:white;cursor:pointer;font:inherit}button:first-of-type{background:#da291c;color:white;border-color:#da291c;margin-right:8px}button:disabled{opacity:.5;cursor:default}';
    const panel = document.createElement('section');
    panel.setAttribute('aria-label', 'Assistente Central COP');
    const heading = document.createElement('h2'); heading.textContent = 'Central COP · Preparar telefone';
    const number = document.createElement('strong'); number.textContent = CopMaxPolicy.nationalPhone(request.phone);
    const help = document.createElement('p'); help.textContent = 'Ao preencher, o assistente abre Novo automaticamente e usa DDD + espaço + número, sem +55. Confira o destino; selecione a skill e confirme a ligação manualmente no MAX.';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const fill = document.createElement('button'); fill.type = 'button'; fill.textContent = 'Preencher campo';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Fechar';
    cancel.addEventListener('click', event => { if (event.isTrusted) clear(); });
    fill.addEventListener('click', async event => {
      if (!event.isTrusted || !current || fill.disabled) return;
      const pending = current;
      fill.disabled = true;
      try {
        CopMaxPolicy.request(pending);
        status.textContent = 'Abrindo formulário e preparando o telefone…';
        await CopMaxPolicy.openField(document);
        if (current !== pending) return;
        CopMaxPolicy.request(pending);
        const field = CopMaxPolicy.field(document);
        const value = CopMaxPolicy.nationalPhone(pending.phone);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        field.focus({preventScroll: true});
        // MAX may refresh address-book suggestions on keyup rather than input.
        // The final space is already in value; synthetic events add no text and
        // never send Enter or click a call control. Legacy codes support MAX's
        // older keyboard handlers alongside the standard key/code properties.
        const space = {key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true, cancelable: true};
        field.dispatchEvent(new KeyboardEvent('keydown', space));
        setter.call(field, value);
        field.dispatchEvent(new Event('input', {bubbles: true}));
        field.dispatchEvent(new Event('change', {bubbles: true}));
        field.dispatchEvent(new KeyboardEvent('keyup', space));
        if (field.value !== value) throw Error('VALUE_NOT_ACCEPTED');
        status.textContent = 'Campo preenchido. Confira no MAX, selecione a skill e faça a ligação manualmente. Nenhuma chamada foi iniciada pelo assistente.';
        current = null;
      } catch (error) {
        if (current !== pending) return;
        fill.disabled = false;
        status.textContent = error.message === 'FIELD_NOT_EMPTY' ? 'O campo já contém texto. Confira e limpe manualmente antes de tentar.' : error.message === 'INVALID_REQUEST' ? 'Preparação expirada. Feche e selecione o contato novamente no portal.' : error.message === 'NEW_UNAVAILABLE' ? 'O botão Novo não está disponível ou não é único. Nenhum campo foi preenchido.' : 'O formulário não ficou disponível para preenchimento seguro. Confira o MAX e tente novamente; nenhum comando de ligação foi enviado.';
      }
    });
    panel.append(heading, number, help, status, fill, cancel); shadow.append(style, panel);
    document.documentElement.append(host);
    expiry = setTimeout(clear, Math.max(0, request.createdAt + 60000 - Date.now()));
    respond({ok: true, code: 'PREPARED'});
  });
})();
