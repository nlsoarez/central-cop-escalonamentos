(() => {
  if (location.origin !== CopMaxPolicy.portal || window.top !== window) return;
  const messages = {
    NO_MAX: 'Abra o MAX e entre na sua sessão neste mesmo navegador.',
    MULTIPLE_MAX: 'Há mais de uma janela MAX. Mantenha apenas a sessão desejada aberta e tente novamente.',
    BUSY: 'Já existe uma preparação em andamento.',
    INVALID_REQUEST: 'Telefone inválido para o assistente.',
    UNTRUSTED_SOURCE: 'A origem da solicitação foi rejeitada pelo assistente (UNTRUSTED_SOURCE).',
    QUERY_FAILED: 'A extensão não conseguiu consultar a janela MAX (QUERY_FAILED). Confira o acesso ao site nas permissões da extensão.',
    MAX_NOT_READY: 'A janela MAX foi localizada, mas o assistente não respondeu (MAX_NOT_READY). Confira se aparece Assistente COP ativo no MAX.',
    UNAVAILABLE: 'Assistente indisponível. Recarregue o portal e o MAX após instalar a extensão.'
  };
  let pending = false;
  function decorate() {
    for (const card of document.querySelectorAll('.contact-card')) {
      const button = card.querySelector('button.max');
      const link = card.querySelector('a.phone-link');
      if (!button || button.dataset.copMaxAssist || !link) continue;
      let phone;
      try {
        const url = new URL(link.href);
        if (url.origin !== 'https://wa.me' || url.search || url.hash) continue;
        phone = CopMaxPolicy.phone('+' + url.pathname.slice(1));
      } catch { continue; }
      // Replace only the disabled placeholder. The original portal has no MAX handler.
      if (!button.disabled) continue;
      const action = document.createElement('button');
      action.type = 'button'; action.className = 'btn subtle';
      action.dataset.copMaxAssist = 'true'; action.textContent = 'Ligar no MAX';
      action.title = 'Enviar telefone para conferência no MAX; não inicia ligação';
      const status = document.createElement('span');
      status.hidden = true;
      status.setAttribute('role', 'status'); status.style.cssText = 'font-size:12px;max-width:260px;white-space:normal';
      action.addEventListener('click', async event => {
        if (!event.isTrusted || pending) return;
        event.stopPropagation(); pending = true; action.disabled = true;
        try {
          const result = await chrome.runtime.sendMessage({type: 'COP_PREPARE_MAX', phone, createdAt: Date.now()});
          status.textContent = result?.ok ? (result.code === 'PREPARED_NO_FOCUS' ? 'Abra a janela MAX para continuar.' : '') : messages[result?.code] || messages.UNAVAILABLE;
          status.hidden = !status.textContent;
        } catch { status.textContent = messages.UNAVAILABLE; status.hidden = false; }
        finally { pending = false; action.disabled = false; }
      });
      button.replaceWith(action); action.after(status);
    }
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return; scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorate(); });
  }).observe(document.body, {childList: true, subtree: true});
  decorate();
})();
