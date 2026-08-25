const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function formatDate(value, withTime = false) {
  if (!value) return 'Date pending';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Kolkata' }).format(date);
}

// Populates the nav's per-lab links (Lab 1, Lab 2, ...) on both index.html and
// lab.html, since each lab now has its own dedicated page.
function renderLabNav(labs, activeLabNumber) {
  const slot = $('[data-nav-labs]');
  if (!slot) return;
  slot.innerHTML = labs.map(lab => `<a href="lab.html?lab=${lab.number}"${lab.number === activeLabNumber ? ' aria-current="page"' : ''}>Lab ${lab.number}</a>`).join('');
}

function wireMobileNav() {
  const menuButton = $('[data-menu-button]');
  menuButton.addEventListener('click', () => { const open = $('[data-nav]').classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
  $$('[data-nav] a').forEach(link => link.addEventListener('click', () => { $('[data-nav]').classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
}
