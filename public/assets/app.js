const state = { content: null, filter: 'all' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function formatDate(value) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${value}T12:00:00+05:30`));
}

function renderLabs() {
  const labs = state.content.labs.filter(lab => state.filter === 'all' || lab.sections.includes(state.filter));
  $('[data-labs]').innerHTML = labs.length ? labs.map(lab => {
    const available = Boolean(lab.file && lab.available);
    const status = available ? 'available' : (lab.visibility === 'scheduled' ? 'scheduled' : 'soon');
    const statusLabel = available ? 'Available' : (lab.visibility === 'scheduled' ? 'Scheduled' : 'Coming soon');
    const action = available
      ? `<a class="download" href="${encodeURI(lab.file)}" download>Download PDF ↘</a>`
      : `<span class="download" aria-disabled="true">Not released</span>`;
    return `<article class="lab-card reveal visible">
      <div class="lab-card-top"><span class="lab-no">LAB / ${String(lab.number).padStart(2, '0')}</span><span class="lab-status ${status}">${statusLabel}</span></div>
      <h3>${escapeHtml(lab.title)}</h3><p>${escapeHtml(lab.summary)}</p>
      <div class="lab-card-footer"><div class="section-tags">${lab.sections.map(s => `<span class="section-tag">${escapeHtml(s)}</span>`).join('')}</div>${action}</div>
    </article>`;
  }).join('') : '<div class="loading-card">No lab sheets match this section yet.</div>';
}

function render(content) {
  document.title = `${content.course.code} · ${content.course.title}`;
  $('[data-hero-eyebrow]').textContent = content.hero.eyebrow;
  $('[data-hero-heading]').innerHTML = escapeHtml(content.hero.heading)
    .replace('Measure it.', '<em>Measure it.</em>')
    .replace('. <em>', '.<br><em>')
    .replace('</em> ', '</em><br>');
  $('[data-hero-intro]').textContent = content.hero.intro;
  $('[data-updated]').textContent = formatDate(content.updatedAt);
  renderLabs();
  $('[data-announcements]').innerHTML = content.announcements.map(item => `<article class="announcement ${escapeHtml(item.level)} reveal">
    <time class="announcement-date" datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time>
    <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>
    <span class="audience">${escapeHtml(item.audience)}</span>
  </article>`).join('') || '<div class="loading-line">No announcements right now.</div>';
  $('[data-schedule]').innerHTML = content.schedule.map(item => `<article class="schedule-card ${escapeHtml(item.accent)} reveal" data-section="${escapeHtml(item.section)}">
    <h3>${escapeHtml(item.section)}</h3><div class="schedule-details"><div><span>DAY & TIME</span><strong>${escapeHtml(item.day)} · ${escapeHtml(item.time)}</strong></div><div><span>VENUE</span><strong>${escapeHtml(item.venue)}</strong></div></div>
  </article>`).join('');
  $('[data-policies]').innerHTML = content.policies.map(item => `<article class="policy reveal"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('');
  observeReveals();
}

function observeReveals() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return $$('.reveal').forEach(el => el.classList.add('visible'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: .12 });
  $$('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  $$('[data-filter]').forEach(item => item.classList.toggle('is-active', item === button));
  renderLabs();
}));

const menuButton = $('[data-menu-button]');
menuButton.addEventListener('click', () => {
  const open = $('[data-nav]').classList.toggle('open');
  menuButton.setAttribute('aria-expanded', open);
  document.body.classList.toggle('menu-open', open);
});
$$('[data-nav] a').forEach(link => link.addEventListener('click', () => {
  $('[data-nav]').classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open');
}));

fetch('data/content.json', { cache: 'no-store' })
  .then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); })
  .then(content => { state.content = content; render(content); })
  .catch(() => {
    $('[data-labs]').innerHTML = '<div class="loading-card">Course content could not be loaded. Please refresh the page.</div>';
    $('[data-announcements]').innerHTML = '<div class="loading-line">Announcements are temporarily unavailable.</div>';
  });

observeReveals();
