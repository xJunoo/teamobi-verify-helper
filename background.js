const LOGIN = 'https://my.teamobi.com/login.html';
const FORUM = 'https://my.teamobi.com/forum.html';
const save = state => chrome.storage.session.set({state});
const load = async () => (await chrome.storage.session.get('state')).state;
let chain = Promise.resolve();
async function clearSiteCookies(tabId) {
  const stores = await chrome.cookies.getAllCookieStores();
  const store = stores.find(item => item.tabIds.includes(tabId));
  if (!store) throw new Error('Không tìm thấy cookie store của tab chạy.');
  const belongsToSite = cookie => {
    const domain = cookie.domain.replace(/^\./, '').toLowerCase();
    return domain === 'my.teamobi.com' || (domain === 'teamobi.com' && !cookie.hostOnly);
  };
  const list = async () => (await chrome.cookies.getAll({domain: 'teamobi.com', storeId: store.id})).filter(belongsToSite);
  for (const cookie of await list()) {
    const details = {url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
      name: cookie.name, storeId: store.id};
    if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
    await chrome.cookies.remove(details);
  }
  if ((await list()).length) throw new Error('Cookie của site chưa được xóa hết.');
}
function loginDestination(url) {
  try {
    const u = new URL(url);
    return u.origin === new URL(LOGIN).origin && (u.pathname === '/forum.html' ||
      (u.pathname === '/app/index.php' && u.searchParams.get('do') === 'login') ||
      /^\/user\/\d+\/[^/]+\.html$/.test(u.pathname));
  } catch { return false; }
}
function loginEndpoint(url) {
  try { const u = new URL(url); return u.origin === new URL(LOGIN).origin &&
    u.pathname === '/app/index.php' && u.searchParams.get('do') === 'login'; }
  catch { return false; }
}

async function handle(m, sender) {
  let s = await load();
  const popup = sender.url === chrome.runtime.getURL('dashboard.html');
  if (m.type === 'STATUS' && popup) return s ? {
    active: s.active, index: s.index + 1, total: s.total, note: s.note, results: s.results
  } : {active: false, note: 'Chọn file TXT để bắt đầu.'};
  if (m.type === 'STOP' && popup) {
    if (s) { s.active = false; s.accounts = []; s.note = 'Đã dừng; đã xóa danh sách mật khẩu khỏi bộ nhớ extension.'; await save(s); }
    return {ok: true};
  }
  if (m.type === 'START' && popup) {
    if (s?.active) throw new Error('Đang chạy. Bấm Dừng trước khi bắt đầu lượt mới.');
    if (!Array.isArray(m.accounts) || !m.accounts.length || m.accounts.some(a =>
      typeof a.user !== 'string' || !a.user || typeof a.pass !== 'string' || !a.pass)) throw new Error('Danh sách TXT không hợp lệ.');
    s = {active: true, accounts: m.accounts, index: 0, total: m.accounts.length,
      phase: 'login', since: Date.now(), hold: Math.max(3, Math.min(300, Number(m.hold) || 5)),
      results: s?.results || [], note: 'Đang mở trang đăng nhập…'};
    const tab = await chrome.tabs.create({url: LOGIN});
    s.tabId = tab.id;
    await save(s);
    await chrome.alarms.create('teamobi-watchdog', {periodInMinutes: 0.5});
    return {ok: true};
  }
  if (m.type === 'TICK' && s?.active && s.phase === 'submitting' && sender.tab?.id !== s.tabId &&
      (sender.tab?.openerTabId === s.tabId || sender.tab?.id === s.pendingTabId) && loginDestination(sender.url)) {
    s.tabId = sender.tab.id; delete s.pendingTabId;
    s.note = 'Login mở tab mới; đã chuyển theo dõi sang tab đó.';
    await save(s);
  }
  if (m.type !== 'TICK' || !s?.active || sender.tab?.id !== s.tabId ||
      !sender.url?.startsWith('https://my.teamobi.com/')) return {};

  async function navigate(url, phase, note) {
    s.phase = phase; s.since = Date.now(); s.note = note;
    await save(s);
    await chrome.tabs.update(s.tabId, {url});
    return {};
  }
  async function fail(note) {
    s.results.push({index: s.index + 1, status: 'UNVERIFIED'});
    s.active = false; s.accounts = []; s.note = note;
    await save(s); return {};
  }
  async function resetSession() {
    s.phase = 'reset'; s.since = Date.now(); s.note = 'Đang xóa cookie TeaMobi để đổi tài khoản…';
    await save(s);
    try { await clearSiteCookies(s.tabId); }
    catch { return fail('Không xóa được cookie TeaMobi. Kiểm tra quyền cookies của extension; đã dừng.'); }
    delete s.pendingTabId;
    return navigate(LOGIN, 'reset', 'Đã xóa cookie TeaMobi. Đang mở lại trang login…');
  }
  if (m.loginFailed && ['submitting', 'menu'].includes(s.phase)) {
    s.results.push({index: s.index + 1, user: s.accounts[s.index].user,
      status: 'LOGIN_FAILED', smsCode: '', note: 'Tên tài khoản hoặc mật khẩu không chính xác'});
    s.accounts[s.index] = null;
    delete s.pendingTabId;
    if (s.index + 1 === s.total) {
      s.active = false; s.accounts = []; s.note = 'Hoàn tất. Tài khoản cuối đăng nhập thất bại; đã ghi lỗi vào bảng.';
      await save(s); return {};
    }
    s.index++; s.skipHold = false;
    return resetSession();
  }
  if (s.phase === 'view') {
    if (Date.now() - s.since < (s.skipHold ? 0 : s.hold * 1000)) return {};
    s.accounts[s.index] = null;
    if (s.index + 1 === s.total) {
      s.active = false; s.accounts = []; s.note = 'Hoàn tất. Giữ trang Tài Khoản và phiên đăng nhập tài khoản cuối.';
      await save(s); return {};
    }
    s.index++;
    s.skipHold = false;
    return resetSession();
  }
  if (s.phase === 'login' && m.auth) {
    return resetSession();
  }
  if (s.phase === 'reset') {
    if (m.loginForm && !m.auth) {
      s.phase = 'login'; s.since = Date.now(); await save(s);
    } else {
      if (Date.now() - s.since > 300000) return fail('Không mở được form login sau khi xóa cookie. Đã dừng.');
      return {};
    }
  }
  if (s.phase === 'login') {
    if (!m.loginForm) {
      if (m.loginLink) return navigate(LOGIN, 'login', 'Đang mở form đăng nhập…');
      if (Date.now() - s.since > 300000) return fail('Hết thời gian chờ form/Cloudflare.');
      await save(s); return {openProfile: true};
    }
    if (Date.now() - s.since > 300000) return fail('Cloudflare chưa cấp token sau 5 phút; chưa gửi login.');
    const account = s.accounts[s.index];
    if (!m.ready) {
      s.note = 'Đã điền tài khoản. Đợi Cloudflare; bấm xác minh trên trang nếu cần.';
      await save(s); return {fill: account};
    }
    s.phase = 'submitting'; s.since = Date.now(); s.note = 'Cloudflare đã cấp token. Đang đăng nhập…';
    await save(s); return {fill: account, submit: true};
  }
  if (s.phase === 'submitting') {
    if (m.auth) {
      return navigate(FORUM, 'menu', 'Đăng nhập thành công. Đang mở forum để lấy link profile…');
    }
    if (m.blank && loginEndpoint(sender.url) && Date.now() - s.since > 2000) {
      return navigate(FORUM, 'menu', 'Trang xử lý login trống. Đang kiểm tra phiên đăng nhập trên forum…');
    }
    if (Date.now() - s.since > 60000) return fail('Không xác nhận được đăng nhập sau 60 giây. Kiểm tra trang; không tự thử lại mật khẩu.');
    if (s.phase === 'submitting' && !m.loginForm) return {openProfile: true};
  }
  if (s.phase === 'menu') {
    if (m.path !== '/forum.html') {
      if (Date.now() - s.since > 60000) return fail('Không mở được forum sau đăng nhập.');
      return {};
    }
    if (m.auth) {
      if (m.accountUrl) {
        const target = new URL(m.accountUrl);
        if (target.origin !== new URL(LOGIN).origin || !/^\/user\/\d+\/[^/]+\.html$/.test(target.pathname)) return fail('Liên kết Tài Khoản không hợp lệ.');
        s.accountPath = target.pathname;
        return navigate(target.href, 'account', 'Đã lấy link từ HTML forum. Đang mở profile…');
      }
    }
    if (Date.now() - s.since > 60000) return fail('Không tìm thấy mục Tài Khoản sau đăng nhập.');
    return {openProfile: true};
  }
  if (s.phase === 'account') {
    if (m.path === s.accountPath && (m.phoneVerified || /^GO TEAM-XT \S+ \S+$/.test(m.smsCode || ''))) {
      const account = s.accounts[s.index];
      const verified = !!m.phoneVerified;
      s.results.push({index: s.index + 1, user: account.user,
        status: verified ? 'PHONE_VERIFIED' : 'SMS_REQUIRED', smsCode: verified ? '' : m.smsCode});
      s.phase = 'view'; s.since = Date.now(); s.skipHold = verified;
      s.note = verified ? 'Tài khoản đã xác thực số điện thoại; chuyển tài khoản tiếp theo…' : `Đã lấy cú pháp SMS (${s.index + 1}/${s.total}).`;
      await save(s);
    } else if (Date.now() - s.since > 60000) return fail('Không tìm thấy cú pháp SMS hoặc trạng thái đã xác thực trong mục Tài Khoản.');
    else return {clickAccount: true};
  }
  return {};
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  chain = chain.then(() => handle(message, sender)).then(reply).catch(async error => {
    const s = await load();
    if (s?.active && message.type === 'TICK') {
      s.active = false; s.accounts = []; s.note = 'Lỗi xử lý trang; đã dừng.'; await save(s);
    }
    reply({error: message.type === 'START' ? error.message : 'Không xử lý được yêu cầu.'});
  });
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  chain = chain.then(async () => {
    const s = await load();
    if (s?.tabId === tabId && s.active) {
      if (s.phase === 'submitting' && s.pendingTabId !== undefined) {
        try {
          const child = await chrome.tabs.get(s.pendingTabId);
          s.tabId = child.id; delete s.pendingTabId; await save(s); return;
        } catch { /* Child also closed: stop below. */ }
      }
      s.active = false; s.accounts = []; s.note = 'Tab đã đóng; đã dừng.'; await save(s);
    }
  }).catch(() => {});
});

chrome.tabs.onCreated.addListener(tab => {
  chain = chain.then(async () => {
    const s = await load();
    if (s?.active && s.phase === 'submitting' && tab.openerTabId === s.tabId) {
      s.pendingTabId = tab.id; await save(s);
    }
  }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (!change.url && change.status !== 'complete') return;
  chain = chain.then(async () => {
    const s = await load();
    if (s?.active && s.phase === 'submitting' && tabId !== s.tabId &&
        (tab.openerTabId === s.tabId || tabId === s.pendingTabId) && loginDestination(tab.url)) {
      s.tabId = tabId; delete s.pendingTabId;
      s.note = 'Tiếp tục xử lý login trong tab mới.'; await save(s);
    }
  }).catch(() => {});
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'teamobi-watchdog') return;
  chain = chain.then(async () => {
    const s = await load();
    if (!s?.active) { await chrome.alarms.clear(alarm.name); return; }
    const age = Date.now() - s.since;
    if (s.phase === 'submitting' && age > 15000) {
      const tab = await chrome.tabs.get(s.tabId);
      if (tab.status === 'complete' && loginEndpoint(tab.url) &&
          !/just a moment|checking your browser|attention required/i.test(tab.title || '')) {
        s.phase = 'menu'; s.since = Date.now();
        s.note = 'Khôi phục từ trang xử lý login. Đang kiểm tra phiên trên forum…';
        await save(s); await chrome.tabs.update(s.tabId, {url: FORUM}); return;
      }
    }
    if (s.phase !== 'view' && age > (['login', 'reset'].includes(s.phase) ? 300000 : 60000)) {
      s.active = false; s.accounts = [];
      s.results.push({index: s.index + 1, status: 'UNVERIFIED'});
      s.note = 'Trang không phản hồi trong thời gian chờ. Đã dừng; không gửi lại login.';
      await save(s); await chrome.alarms.clear(alarm.name);
    }
  }).catch(async () => {
    const s = await load();
    if (s?.active) {s.active = false; s.accounts = []; s.note = 'Không truy cập được tab chạy; đã dừng.'; await save(s);}
  });
});

let openingDashboard = false;
chrome.action.onClicked.addListener(async () => {
  if (openingDashboard) return;
  openingDashboard = true;
  try {
    const {dashboardTabId} = await chrome.storage.session.get('dashboardTabId');
    if (dashboardTabId !== undefined) {
      try {
        const tab = await chrome.tabs.get(dashboardTabId);
        if (tab.url === chrome.runtime.getURL('dashboard.html')) {
          await chrome.tabs.update(tab.id, {active: true});
          await chrome.windows.update(tab.windowId, {focused: true});
          return;
        }
      } catch { /* Closed dashboard: create another tab and restore session results. */ }
    }
    const tab = await chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')});
    await chrome.storage.session.set({dashboardTabId: tab.id});
  } finally { openingDashboard = false; }
});
