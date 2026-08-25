const state = { content: null };

function renderLabsIndex(labs) {
  $('[data-labs-index]').innerHTML = labs.length ? labs.map(lab => {
    const available = Boolean(lab.file && lab.available);
    const actions = available ? `<div class="file-actions"><a class="button button-secondary" href="${encodeURI(lab.file)}" target="_blank" rel="noopener">View PDF ↗</a><a class="button button-primary" href="${encodeURI(lab.file)}" download>Download</a></div>` : '<span class="download" aria-disabled="true">Not released</span>';
    return `<article class="lab-row"><div class="lab-number">${String(lab.number).padStart(2, '0')}</div><div class="lab-copy"><h3><a href="lab.html?lab=${lab.number}">${escapeHtml(lab.title)}</a></h3><p>${escapeHtml(lab.summary)}</p>${lab.fileSize ? `<span class="file-size">PDF · ${escapeHtml(lab.fileSize)}</span>` : ''}</div>${actions}</article>`;
  }).join('') : '<div class="empty-state">No lab sheets have been released.</div>';
}

function render(content) {
  state.content = content;
  document.title = `${content.course.code} · ${content.course.title}`;
  $('[data-hero-eyebrow]').textContent = content.hero.eyebrow;
  $('[data-hero-intro]').textContent = content.hero.intro;
  $('[data-instructor]').textContent = content.course.instructor;
  $('[data-instructor-email]').textContent = content.course.email;
  $('[data-instructor-email]').href = `mailto:${content.course.email}`;
  $('[data-updated]').textContent = formatDate(content.updatedAt);
  $('[data-resources]').innerHTML = (content.resources || []).map(item => `<article class="resource-card"><div class="resource-icon" aria-hidden="true">PDF</div><div><span class="resource-label">COURSE RESOURCE</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p>${item.fileSize ? `<span class="file-size">PDF · ${escapeHtml(item.fileSize)}</span>` : ''}</div>${item.available ? `<div class="file-actions"><a class="button button-secondary" href="${encodeURI(item.file)}" target="_blank" rel="noopener">View PDF ↗</a><a class="button button-primary" href="${encodeURI(item.file)}" download>Download</a></div>` : '<span class="download" aria-disabled="true">Not available</span>'}</article>`).join('');
  renderLabsIndex(content.labs);
  renderLabNav(content.labs);
  $('[data-announcements]').innerHTML = content.announcements.map(item => `<article class="announcement ${escapeHtml(item.level)}"><time class="announcement-date" datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div><span class="audience">${escapeHtml(item.audience)}</span></article>`).join('') || '<div class="empty-state">No announcements right now.</div>';
  $('[data-schedule]').innerHTML = content.schedule.map(item => `<article class="schedule-card"><h3>Section ${escapeHtml(item.section)}</h3><div class="schedule-details"><div><span>DAY & TIME</span><strong>${escapeHtml(item.day)} · ${escapeHtml(item.time)}</strong></div><div><span>ROOM</span><strong>${escapeHtml(item.venue)}</strong></div><div><span>LAB INSTRUCTOR</span><strong>${escapeHtml(content.course.instructor)}</strong></div><div class="wide"><span>TEACHING ASSISTANTS</span><strong>${(item.tas || []).map(escapeHtml).join(' · ')}</strong></div></div></article>`).join('');
  $('[data-policies]').innerHTML = content.policies.map(item => `<article class="policy${item.strict ? ' strict' : ''}"><span class="policy-level">${item.strict ? 'STRICT RULE' : 'GUIDELINE'}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join('');
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
    board.innerHTML = '<p>The live board could not be loaded. Please refresh the page or check again shortly.</p>';
    board.setAttribute('aria-busy', 'false');
    status.textContent = 'Live refresh is temporarily unavailable.';
  }
}

wireMobileNav();

fetch('data/content.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); }).then(render).catch(() => {
  $('[data-labs-index]').innerHTML = '<div class="empty-state">Course content is temporarily unavailable. Please refresh the page.</div>';
  $('[data-announcements]').innerHTML = '<div class="empty-state">Announcements are temporarily unavailable.</div>';
});
refreshLiveBoard();
setInterval(refreshLiveBoard, 60_000);
