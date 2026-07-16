document.addEventListener('DOMContentLoaded', async () => {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const loading = document.getElementById('loading-screen');

  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const revealItems = document.querySelectorAll('.reveal');
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.12 })
    : null;
  revealItems.forEach((item) => observer ? observer.observe(item) : item.classList.add('visible'));

  renderCountdown();

  if (document.body.dataset.page === 'home') {
    await renderHomeData();
  }

  loading?.classList.add('loaded');
});

function renderCountdown() {
  const countdown = document.getElementById('countdown');
  if (!countdown) return;
  const target = new Date('2026-07-22T09:00:00-05:00');
  const tick = () => {
    const diff = target - new Date();
    if (diff <= 0) {
      countdown.innerHTML = '<div><strong>Live</strong><span>Now</span></div>';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff / 3600000) % 24);
    const minutes = Math.floor((diff / 60000) % 60);
    countdown.innerHTML = `
      <div><strong>${days}</strong><span>Days</span></div>
      <div><strong>${hours}</strong><span>Hours</span></div>
      <div><strong>${minutes}</strong><span>Minutes</span></div>
    `;
  };
  tick();
  setInterval(tick, 60000);
}

async function renderHomeData() {
  const [days, speakerPayload] = await Promise.all([
    csvLoader.loadSessionDays(),
    speakerData.load()
  ]);
  const sessions = days.flatMap((day) => day.rows);
  renderStats(days, speakerPayload.speakers);
  renderFeaturedKeynote(sessions);
  renderAnnouncements(days);
}

function renderStats(days, speakers) {
  const stats = document.getElementById('conference-stats');
  if (!stats) return;
  const sessionCount = days.reduce((sum, day) => sum + day.rows.length, 0);
  stats.innerHTML = `
    <div><strong>${days.length}</strong><span>Days</span></div>
    <div><strong>${sessionCount}</strong><span>Sessions</span></div>
    <div><strong>${speakers.length}</strong><span>Speakers</span></div>
  `;
}

function renderFeaturedKeynote(sessions) {
  const featured = document.getElementById('featured-keynote');
  if (!featured) return;
  const keynote = sessions.find((session) => session.Session_Type === 'Keynote') || sessions[0];
  if (!keynote) {
    featured.innerHTML = '<div class="empty-state">Featured session forthcoming.</div>';
    return;
  }
  featured.innerHTML = `
    <p class="card-label">Featured Keynote</p>
    <h2>${UTILS.escapeHTML(keynote.Session_Title)}</h2>
    <p>${UTILS.escapeHTML(keynote.Presenter)}</p>
    <div class="detail-meta">
      <span>${UTILS.escapeHTML(keynote.Day)}</span>
      <span>${UTILS.escapeHTML(keynote.Time)}</span>
      <span>${UTILS.escapeHTML(keynote.Room || 'TBD')}</span>
    </div>
    <a class="btn btn-outline" href="${UTILS.sessionUrl(keynote)}">View Session</a>
  `;
}

async function renderAnnouncements(days) {
  const list = document.getElementById('announcement-list');
  if (!list) return;
  const announcements = await csvLoader.loadCSV('announcements.csv', { optional: true });
  if (announcements.length) {
    list.innerHTML = announcements.map((item) => `
      <article class="announcement-card">
        <span class="chip">${UTILS.escapeHTML(item.Date || item.Day || 'Update')}</span>
        <h3>${UTILS.escapeHTML(item.Title || 'Announcement')}</h3>
        <p>${UTILS.escapeHTML(item.Message || item.Description || '')}</p>
      </article>
    `).join('');
    return;
  }
  list.innerHTML = days.map((day) => `
    <article class="announcement-card">
      <span class="chip">${UTILS.escapeHTML(day.day)}</span>
      <h3>${UTILS.escapeHTML(day.rows.length)} sessions loaded</h3>
      <p>Daily updates, room changes, and reminders can be added later through an optional announcements CSV.</p>
    </article>
  `).join('');
}
