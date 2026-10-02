const statusEl = document.querySelector('#status');
const send = message => chrome.runtime.sendMessage(message);
let renderedCount = 0;
let refreshing = false;
function appendResults(results = []) {
  const table = document.querySelector('#results');
  if (results.length < renderedCount) { table.replaceChildren(); renderedCount = 0; }
  for (const r of results.slice(renderedCount)) {
    const row = document.createElement('tr');
    const status = r.status === 'PHONE_VERIFIED' ? 'Đã xác thực số điện thoại'
      : r.status === 'SMS_REQUIRED' ? 'Chưa xác thực'
      : r.status === 'LOGIN_FAILED' ? 'Sai tài khoản / mật khẩu' : 'Chưa xác nhận';
    for (const [index, text] of [String(++renderedCount), r.user || `Dòng ${r.index}`, status, r.smsCode || '—'].entries()) {
      const cell = document.createElement('td');
      if (index === 2) {
        const badge = document.createElement('span');
        badge.className = `result-badge ${r.status === 'PHONE_VERIFIED' ? 'verified' : r.status === 'SMS_REQUIRED' ? 'pending' : 'error'}`;
        badge.textContent = text;
        cell.appendChild(badge);
      } else if (index === 3 && r.smsCode) {
        const wrap = document.createElement('div');
        wrap.className = 'sms-cell';
        const code = document.createElement('span');
        code.textContent = r.smsCode;
        const copy = document.createElement('button');
        copy.type = 'button'; copy.className = 'copy-code'; copy.textContent = 'Copy';
        copy.title = 'Sao chép cú pháp SMS';
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(r.smsCode);
            copy.textContent = 'Đã copy';
          } catch {
            copy.textContent = 'Không copy được';
          }
          setTimeout(() => { copy.textContent = 'Copy'; }, 1600);
        });
        wrap.appendChild(code); wrap.appendChild(copy); cell.appendChild(wrap);
      } else cell.textContent = text;
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  document.querySelector('#count').textContent = String(renderedCount);
  document.querySelector('#empty').hidden = renderedCount > 0;
}
function formatResults(results = []) {
  return results.map(r => r.status === 'PHONE_VERIFIED'
    ? `${r.user} | TÀI KHOẢN ĐÃ ĐƯỢC XÁC THỰC SỐ ĐIỆN THOẠI`
    : r.status === 'SMS_REQUIRED' ? `${r.user} | ${r.smsCode}`
    : r.status === 'LOGIN_FAILED' ? `${r.user} | ĐĂNG NHẬP THẤT BẠI | ${r.note}`
    : `Dòng ${r.index} | ${r.status}`).join('\n');
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const s = await send({type: 'STATUS'});
    statusEl.textContent = `${s.index ? `${s.index}/${s.total}\n` : ''}${s.note || ''}`;
    document.querySelector('#start').disabled = !!s.active;
    document.querySelector('#stop').disabled = !s.active;
    appendResults(s.results);
    document.querySelector('#download').disabled = !s.results?.length;
    document.querySelector('#total').textContent = String(s.total || 0);
    document.querySelector('#processed').textContent = String(s.results?.length || 0);
    document.querySelector('#verified').textContent = String(s.results?.filter(r => r.status === 'PHONE_VERIFIED').length || 0);
    document.querySelector('#pending').textContent = String(s.results?.filter(r => r.status === 'SMS_REQUIRED').length || 0);
  } catch { statusEl.textContent = 'Không kết nối được extension.'; }
  finally { refreshing = false; }
}
document.querySelector('#start').addEventListener('click', async () => {
  try {
    const file = document.querySelector('#file').files[0];
    if (!file) throw new Error('Hãy chọn file TXT.');
    const accounts = [];
    (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim() || line.trimStart().startsWith('#')) return;
      const separator = line.indexOf('|');
      const user = line.slice(0, separator).trim();
      const pass = line.slice(separator + 1);
      if (separator < 1 || !user || !pass) throw new Error(`Dòng ${i + 1}: cần tài_khoản|mật_khẩu.`);
      accounts.push({user, pass});
    });
    if (!accounts.length) throw new Error('File không có tài khoản.');
    const result = await send({type: 'START', accounts, hold: document.querySelector('#hold').value});
    if (result.error) throw new Error(result.error);
    document.querySelector('#file').value = '';
    await refresh();
  } catch (error) { statusEl.textContent = error.message; }
});
document.querySelector('#stop').addEventListener('click', async () => {
  await send({type: 'STOP'}); await refresh();
});
document.querySelector('#download').addEventListener('click', async () => {
  const s = await send({type: 'STATUS'});
  const url = URL.createObjectURL(new Blob(['\uFEFF' + formatResults(s.results)], {type: 'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'teamobi-results.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
refresh();
setInterval(refresh, 1500);

const marketPopup = document.querySelector('#market-popup');
if (!sessionStorage.getItem('market-popup-seen')) {
  marketPopup.showModal();
  sessionStorage.setItem('market-popup-seen', '1');
}
marketPopup.addEventListener('click', event => {
  if (event.target !== marketPopup) return;
  const bounds = marketPopup.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) marketPopup.close();
});
