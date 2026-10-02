(() => {
  let busy = false;
  let accountClicked = false;
  function visible(el) { return !!el && el.getClientRects().length > 0; }
  function setInput(el, value) {
    if (el.value === value) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function tokenReady(form) {
    return !!form?.querySelector('input[name="cf-turnstile-response"]')?.value?.trim();
  }
  function openProfile(account) {
    const selector = '[data-bs-toggle="dropdown"], [data-toggle="dropdown"], .dropdown-toggle, [aria-haspopup="true"]';
    const container = account?.closest('.dropdown') || account?.closest('.dropdown-menu')?.parentElement;
    const local = container?.querySelector(selector);
    const toggle = visible(local) ? local : [...document.querySelectorAll(selector)].find(el =>
      visible(el) && (el.textContent + ' ' + (el.parentElement?.textContent || ''))
        .normalize('NFC').toLowerCase().includes('xin chào'));
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  }
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const user = document.querySelector('#userlog');
      const pass = document.querySelector('input[name="pass"]');
      const button = document.querySelector('#loginBtn');
      const form = user?.form;
      const loginForm = visible(user) && visible(pass) && !!form;
      const links = [...document.querySelectorAll('a[href]')];
      const account = links.find(a => a.matches('.dropdown-item') &&
        a.textContent.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase() === 'tài khoản' &&
        a.origin === location.origin && /^\/user\/\d+\/[^/]+\.html$/.test(a.pathname));
      const logout = links.find(a => /logout/i.test(a.href) ||
        ['đăng xuất', 'thoát', 'logout'].includes(a.textContent.normalize('NFC').trim().toLowerCase()));
      const loginLink = links.some(a => new URL(a.href).pathname === '/login.html');
      const normalizedText = (document.body?.innerText || '').normalize('NFC').replace(/\s+/g, ' ').toUpperCase();
      const phoneVerified = normalizedText.includes('TÀI KHOẢN ĐÃ ĐƯỢC XÁC THỰC SỐ ĐIỆN THOẠI');
      const loginFailed = [...document.querySelectorAll('h2')].some(el => visible(el) &&
        el.textContent.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() === 'đăng nhập thất bại') &&
        normalizedText.includes('TÊN TÀI KHOẢN HOẶC MẬT KHẨU KHÔNG CHÍNH XÁC');
      const smsCode = [...document.querySelectorAll('.sms-code-myu')].filter(visible)
        .map(el => el.textContent.replace(/\s+/g, ' ').trim())
        .find(text => /^GO TEAM-XT \S+ \S+$/.test(text)) || '';
      const result = await chrome.runtime.sendMessage({type: 'TICK', loginForm, loginLink,
        auth: !!logout || !!account, logout: logout?.href, accountUrl: account?.href, path: location.pathname,
        phoneVerified, smsCode, loginFailed,
        blank: document.readyState === 'complete' && !document.body?.innerText.trim() &&
          !document.querySelector('form, iframe, .cf-turnstile'),
        ready: loginForm && tokenReady(form) && visible(button) && !button.disabled});
      if (result?.openProfile) openProfile(account);
      if (result?.fill && loginForm) {
        setInput(user, result.fill.user);
        setInput(pass, result.fill.pass);
        // Read the normal site's token immediately before submitting. Never alter it.
        if (result.submit && tokenReady(form) && visible(button) && !button.disabled) {
          // Keep this submission in the tracked tab, even when the site uses _blank.
          form.target = '_self';
          button.formTarget = '_self';
          button.click();
        }
      }
      if (result?.clickAccount && account && !accountClicked) {
        if (visible(account)) {
          accountClicked = true;
          account.click();
        } else {
          openProfile(account);
        }
      }
    } catch { /* Navigation or extension reload: next page/tick resumes from session state. */ }
    finally { busy = false; }
  }
  tick();
  setInterval(tick, 1000);
})();
