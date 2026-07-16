class ScheduleController {
  constructor() {
    this.tabs = document.getElementById('schedule-tabs');
    this.list = document.getElementById('schedule-list');
    this.days = [];
    this.activeDay = '';
    this.init();
  }

  async init() {
    if (!this.tabs || !this.list) return;
    this.days = await csvLoader.loadSessionDays();
    this.activeDay = this.days[0]?.day || '';
    this.renderTabs();
    this.renderSchedule();
  }

  renderTabs() {
    this.tabs.innerHTML = this.days.map((day) => `
      <button class="tab-btn ${day.day === this.activeDay ? 'active' : ''}" type="button" role="tab" aria-selected="${day.day === this.activeDay}" data-day="${UTILS.escapeAttribute(day.day)}">
        ${UTILS.escapeHTML(day.day)}
      </button>
    `).join('');
    this.tabs.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeDay = button.dataset.day;
        this.renderTabs();
        this.renderSchedule();
      });
    });
  }

  renderSchedule() {
    const day = this.days.find((item) => item.day === this.activeDay);
    if (!day) {
      this.list.innerHTML = '<div class="empty-state">No schedule data found.</div>';
      return;
    }
    const grouped = day.rows.reduce((groups, session) => {
      const time = session.Time || 'Time TBD';
      groups[time] = groups[time] || [];
      groups[time].push(session);
      return groups;
    }, {});

    this.list.innerHTML = Object.entries(grouped).map(([time, sessions]) => `
      <div class="timeline-block reveal">
        <div class="timeline-time">${UTILS.escapeHTML(time)}</div>
        <div class="timeline-sessions">
          ${sessions.map((session) => this.sessionCard(session)).join('')}
        </div>
      </div>
    `).join('');
    requestAnimationFrame(() => {
      this.list.querySelectorAll('.reveal').forEach((item) => item.classList.add('visible'));
    });
  }

  sessionCard(session) {
    return `
      <article class="session-card ${UTILS.slug(session.Session_Type)}">
        <a href="${UTILS.sessionUrl(session)}">
          <div class="session-topline">
            <span>${UTILS.escapeHTML(session.Time || '')}</span>
            <span>${UTILS.escapeHTML(session.Room || 'TBD')}</span>
          </div>
          <h3>${UTILS.escapeHTML(session.Session_Title || '')}</h3>
          <p>${UTILS.escapeHTML(session.Presenter || '')}</p>
          <div class="chip-row">
            <span class="chip">${UTILS.escapeHTML(session.Session_Type || '')}</span>
            ${session.Track ? `<span class="chip">${UTILS.escapeHTML(session.Track)}</span>` : ''}
          </div>
        </a>
      </article>
    `;
  }
}

class SessionDetailController {
  constructor() {
    this.container = document.getElementById('session-detail');
    this.init();
  }

  async init() {
    if (!this.container) return;
    const [sessions, speakerPayload] = await Promise.all([
      csvLoader.loadAllSessions(),
      speakerData.load()
    ]);
    const params = new URLSearchParams(window.location.search);
    const day = params.get('day');
    const id = params.get('id');
    const title = params.get('title');
    const session = sessions.find((item) => item.Day === day && item.Session_ID === id) ||
      sessions.find((item) => item.Session_Title === title) ||
      sessions[0];

    if (!session) {
      this.container.innerHTML = '<div class="empty-state">Session not found.</div>';
      return;
    }

    document.title = `${session.Session_Title} | Summer Learning Institute 2026`;
    const speakers = speakerPayload.speakers.filter((speaker) => speaker.Sessions.some((item) => item.Session_Title === session.Session_Title));
    const related = sessions
      .filter((item) => item.Session_Title !== session.Session_Title && item.Presenter && session.Presenter && UTILS.normalize(item.Presenter).split(' ').some((part) => part.length > 3 && UTILS.normalize(session.Presenter).includes(part)))
      .slice(0, 3);

    this.container.innerHTML = `
      <article class="session-detail-card">
        <p class="eyebrow">${UTILS.escapeHTML(session.Day || '')}</p>
        <h1>${UTILS.escapeHTML(session.Session_Title || '')}</h1>
        <div class="detail-meta">
          <span>${UTILS.escapeHTML(session.Time || '')}</span>
          <span>Room ${UTILS.escapeHTML(session.Room || 'TBD')}</span>
          <span>${UTILS.escapeHTML(session.Session_Type || '')}</span>
        </div>
        <h2>Presenter</h2>
        <p>${UTILS.escapeHTML(session.Presenter || '')}</p>
        <h2>Description</h2>
        <p>${UTILS.escapeHTML(session.Description || 'Session description forthcoming.')}</p>
        <div class="speaker-bio-panel">
          <h2>Speaker Bio</h2>
          ${speakers.length ? speakers.map((speaker) => `
            <div class="mini-speaker">
              <img src="${UTILS.escapeAttribute(speaker.Headshot || 'images/speakers/placeholder.svg')}" alt="${UTILS.escapeHTML(speaker.Name)}" loading="lazy" />
              <div>
                <strong>${UTILS.escapeHTML(speaker.Name)}</strong>
                <p>${UTILS.escapeHTML(speaker.Bio || 'Biography forthcoming.')}</p>
              </div>
            </div>
          `).join('') : '<p>Speaker bio forthcoming.</p>'}
        </div>
        <h2>Related Sessions</h2>
        <div class="related-grid">
          ${related.length ? related.map((item) => `<a class="related-card" href="${UTILS.sessionUrl(item)}"><strong>${UTILS.escapeHTML(item.Session_Title)}</strong><span>${UTILS.escapeHTML(item.Day)} · ${UTILS.escapeHTML(item.Time)}</span></a>`).join('') : '<p>No related sessions found yet.</p>'}
        </div>
      </article>
    `;
  }
}

if (document.getElementById('schedule-list')) {
  new ScheduleController();
}

if (document.getElementById('session-detail')) {
  new SessionDetailController();
}
