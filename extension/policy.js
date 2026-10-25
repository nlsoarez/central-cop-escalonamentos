/* Shared isolated-world validation. No credentials, persistent storage or network. */
globalThis.CopMaxPolicy = Object.freeze({
  portal: 'https://central-cop-escalonamentos.vercel.app',
  max: 'https://max.niceincontact.com',
  trustedSender(sender, id) {
    try { return sender.id === id && sender.frameId === 0 && Number.isInteger(sender.tab?.id) && new URL(sender.url).origin === this.portal; }
    catch { return false; }
  },
  phone(value) {
    if (typeof value !== 'string' || !/^\+55[1-9]\d{9,10}$/.test(value)) throw Error('INVALID_PHONE');
    return value;
  },
  nationalPhone(value) { const national = this.phone(value).slice(3); return national.slice(0, 2) + ' ' + national.slice(2) + ' '; },
  async openField(document, wait = () => new Promise(resolve => setTimeout(resolve, 80))) {
    try { return this.field(document); }
    catch (error) { if (error.message !== 'FIELD_UNAVAILABLE') throw error; }
    const visible = e => e.isConnected && e.getClientRects().length && e.checkVisibility({checkVisibilityCSS: true});
    // An existing address book in another context must not be toggled or replaced.
    if ([...document.querySelectorAll('.advanced-address-book-ui[role="dialog"]')].some(visible)) throw Error('FIELD_UNAVAILABLE');
    const buttons = [...document.querySelectorAll('button[title="Novo"], button[title="New"]')].filter(e => visible(e) && !e.disabled);
    if (buttons.length !== 1) throw Error('NEW_UNAVAILABLE');
    buttons[0].click();
    for (let attempt = 0; attempt < 25; attempt++) {
      try { return this.field(document); }
      catch (error) { if (error.message !== 'FIELD_UNAVAILABLE') throw error; }
      await wait();
    }
    throw Error('FIELD_UNAVAILABLE');
  },
  request(message, now = Date.now()) {
    if (!message || message.type !== 'COP_PREPARE_MAX' || !Number.isFinite(message.createdAt) || now - message.createdAt < 0 || now - message.createdAt > 60000) throw Error('INVALID_REQUEST');
    return {type: 'COP_PREPARE_MAX', phone: this.phone(message.phone), createdAt: message.createdAt};
  },
  field(document) {
    const candidates = [...document.querySelectorAll('.advanced-address-book-ui[role="dialog"][data-state="new"][data-context="none"][data-mediatype="call"] input[type="search"][aria-label="Número de telefone ou termo de busca"], .advanced-address-book-ui[role="dialog"][data-state="new"][data-context="none"][data-mediatype="call"] input[type="search"][aria-label="Phone Number or Search Term"]')]
      .filter(e => e.isConnected && !e.disabled && !e.readOnly && e.getClientRects().length && e.checkVisibility({checkVisibilityCSS: true}));
    if (candidates.length !== 1) throw Error('FIELD_UNAVAILABLE');
    if (candidates[0].value.trim()) throw Error('FIELD_NOT_EMPTY');
    return candidates[0];
  }
});
