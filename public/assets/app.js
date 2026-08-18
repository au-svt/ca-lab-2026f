const state = { content: null, filter: 'all' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function formatDate(value, withTime = false) {
  if (!value) return 'Date pending';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Asia/Kolkata' }).format(date);
}

function renderLabs() {
  const labs = state.content.labs.filter(lab => state.filter === 'all' || lab.sections.includes(state.filter));
  $('[data-labs]').innerHTML = labs.length ? labs.map(lab => {
    const available = Boolean(lab.file && lab.available);
    return `<article class="lab-row"><div class="lab-number">${String(lab.number).padStart(2, '0')}</div><div class="lab-copy"><h3>${escapeHtml(lab.title)}</h3><p>${escapeHtml(lab.summary)}</p></div><div class="section-tags">${lab.sections.map(section => `<span class="section-tag">${escapeHtml(section)}</span>`).join('')}</div>${available ? `<a class="download" href="${encodeURI(lab.file)}" download>Download PDF ↓</a>` : '<span class="download" aria-disabled="true">Not released</span>'}</article>`;
  }).join('') : '<div class="empty-state">No lab sheets match this section.</div>';
}

function render(content) {
  state.content = content;
  document.title = `${content.course.code} · ${content.course.title}`;
  $('[data-hero-eyebrow]').textContent = content.hero.eyebrow;
  $('[data-hero-intro]').textContent = content.hero.intro;
  $('[data-updated]').textContent = formatDate(content.updatedAt);
  $('[data-resources]').innerHTML = (content.resources || []).map(item => `<article class="resource-card"><div class="resource-icon" aria-hidden="true">PDF</div><div><span class="resource-label">COURSE RESOURCE</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div>${item.available ? `<a class="button button-primary" href="${encodeURI(item.file)}" download>Download PDF</a>` : '<span class="download" aria-disabled="true">Not available</span>'}</article>`).join('');
  renderLabs();
  $('[data-announcements]').innerHTML = content.announcements.map(item => `<article class="announcement ${escapeHtml(item.level)}"><time class="announcement-date" datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div><span class="audience">${escapeHtml(item.audience)}</span></article>`).join('') || '<div class="empty-state">No announcements right now.</div>';
  $('[data-schedule]').innerHTML = content.schedule.map(item => `<article class="schedule-card"><h3>Section ${escapeHtml(item.section)}</h3><div class="schedule-details"><div><span>DAY & TIME</span><strong>${escapeHtml(item.day)} · ${escapeHtml(item.time)}</strong></div><div><span>VENUE</span><strong>${escapeHtml(item.venue)}</strong></div></div></article>`).join('');
  $('[data-policies]').innerHTML = content.policies.map(item => `<article class="policy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('');
}

async function refreshLiveBoard() {
  const board = $('[data-live-board]');
  const status = $('[data-live-status]');
  try {
    const response = await fetch('https://api.github.com/repos/au-svt/ca-lab-2026f/issues/1', { headers: { Accept: 'application/vnd.github.full+json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Board unavailable');
    const issue = await response.json();
    board.innerHTML = issue.body_html || '<p>No live items have been posted.</p>';
    board.setAttribute('aria-busy', 'false');
    status.textContent = `Last checked ${formatDate(new Date().toISOString(), true)} · refreshes every 60 seconds`;
  } catch {
    board.innerHTML = '<p>The live board could not be loaded. Use the “Open board separately” link below.</p>';
    board.setAttribute('aria-busy', 'false');
    status.textContent = 'Live refresh is temporarily unavailable.';
  }
}

$$('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; $$('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button)); renderLabs(); }));
const menuButton = $('[data-menu-button]');
menuButton.addEventListener('click', () => { const open = $('[data-nav]').classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
$$('[data-nav] a').forEach(link => link.addEventListener('click', () => { $('[data-nav]').classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));

fetch('data/content.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); }).then(render).catch(() => {
  $('[data-labs]').innerHTML = '<div class="empty-state">Course content is temporarily unavailable. Please refresh the page.</div>';
  $('[data-announcements]').innerHTML = '<div class="empty-state">Announcements are temporarily unavailable.</div>';
});
refreshLiveBoard();
setInterval(refreshLiveBoard, 60_000);
