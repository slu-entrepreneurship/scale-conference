class SpeakerData {
  constructor() {
    this.ready = null;
  }

  async load() {
    if (this.ready) return this.ready;
    this.ready = Promise.all([
      csvLoader.loadCSV('speakers.csv'),
      csvLoader.loadAllSessions()
    ]).then(([speakers, sessions]) => ({ speakers: this.enrichSpeakers(speakers, sessions), sessions }));
    return this.ready;
  }

  enrichSpeakers(speakers, sessions) {
    return speakers
      .map((speaker) => ({
        ...speaker,
        Sessions: this.sessionsForSpeaker(speaker, sessions)
      }))
      .sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
  }

  sessionsForSpeaker(speaker, sessions) {
    const normalizedName = UTILS.normalize(speaker.Name);
    if (!normalizedName) return [];
    const nameParts = normalizedName.split(' ');
    const first = nameParts[0];
    const last = nameParts[nameParts.length - 1];
    return sessions.filter((session) => {
      const presenter = UTILS.normalize(session.Presenter);
      return presenter.includes(normalizedName) || Boolean(first && last && presenter.includes(first) && presenter.includes(last));
    });
  }

  socialLinks(speaker) {
    const links = [];
    if (speaker.Website) links.push(`<a class="chip" href="${UTILS.escapeAttribute(UTILS.linkWithProtocol(speaker.Website))}" target="_blank" rel="noopener noreferrer">Website</a>`);
    if (speaker.LinkedIn) links.push(`<a class="chip" href="${UTILS.escapeAttribute(UTILS.linkWithProtocol(speaker.LinkedIn))}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`);
    if (speaker.Email) links.push(`<a class="chip" href="mailto:${UTILS.escapeAttribute(speaker.Email)}">Email</a>`);
    return links.join('');
  }

  card(speaker) {
    const sessions = speaker.Sessions || [];
    const sessionMarkup = sessions.length
      ? sessions.map((session) => `<li><a href="${UTILS.sessionUrl(session)}">${UTILS.escapeHTML(session.Session_Title)}</a></li>`).join('')
      : '<li>Session details forthcoming</li>';

    return `
      <article class="speaker-card reveal">
        <img class="speaker-photo" src="${UTILS.escapeAttribute(speaker.Headshot || 'images/speakers/placeholder.svg')}" alt="${UTILS.escapeHTML(speaker.Name || 'Speaker')}" loading="lazy" decoding="async" />
        <div class="speaker-body">
          <h3>${UTILS.escapeHTML(speaker.Name || '')}</h3>
          <p class="speaker-credentials">${UTILS.escapeHTML(speaker.Credentials || '')}</p>
          <p class="speaker-org">${UTILS.escapeHTML(speaker.Organization || '')}</p>
          <p class="speaker-bio">${UTILS.escapeHTML(speaker.Bio || 'Biography forthcoming.')}</p>
          <div class="speaker-sessions">
            <h4>Sessions</h4>
            <ul>${sessionMarkup}</ul>
          </div>
          <div class="chip-row">${this.socialLinks(speaker)}</div>
        </div>
      </article>
    `;
  }
}

const speakerData = new SpeakerData();

class SpeakersController {
  constructor() {
    this.grid = document.getElementById('speakers-grid');
    this.previewGrid = document.getElementById('speaker-preview-grid');
    this.search = document.getElementById('speaker-search');
    this.filter = document.getElementById('speaker-filter');
    this.count = document.getElementById('speaker-count');
    this.bind();
    this.render();
  }

  bind() {
    this.search?.addEventListener('input', () => this.render());
    this.filter?.addEventListener('change', () => this.render());
  }

  async render() {
    const { speakers } = await speakerData.load();
    if (this.previewGrid) {
      this.previewGrid.innerHTML = speakers.slice(0, 6).map((speaker) => speakerData.card(speaker)).join('');
      requestAnimationFrame(() => {
        this.previewGrid.querySelectorAll('.reveal').forEach((item) => item.classList.add('visible'));
      });
    }
    if (!this.grid) return;

    const query = (this.search?.value || '').trim().toLowerCase();
    const filter = this.filter?.value || 'all';
    const filtered = speakers.filter((speaker) => {
      const sessionText = (speaker.Sessions || []).map((session) => `${session.Session_Title} ${session.Track}`).join(' ');
      const haystack = `${speaker.Name} ${speaker.Credentials} ${speaker.Organization} ${speaker.Bio} ${speaker.Email} ${sessionText}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesFilter = filter === 'all' ||
        (filter === 'organization' && speaker.Organization) ||
        (filter === 'email' && speaker.Email) ||
        (filter === 'sessions' && speaker.Sessions?.length);
      return matchesQuery && matchesFilter;
    });

    this.count.textContent = `${filtered.length} speaker${filtered.length === 1 ? '' : 's'}`;
    this.grid.innerHTML = filtered.length
      ? filtered.map((speaker) => speakerData.card(speaker)).join('')
      : '<div class="empty-state">No speakers match that search.</div>';
    requestAnimationFrame(() => {
      this.grid.querySelectorAll('.reveal').forEach((item) => item.classList.add('visible'));
    });
  }
}

if (document.getElementById('speakers-grid') || document.getElementById('speaker-preview-grid')) {
  new SpeakersController();
}
