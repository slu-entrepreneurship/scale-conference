class SearchController {
  constructor() {
    this.input = document.getElementById('site-search');
    this.results = document.getElementById('search-results');
    this.data = null;
    this.bind();
  }

  bind() {
    this.input?.addEventListener('input', () => this.search(this.input.value));
  }

  async load() {
    if (this.data) return this.data;
    const [{ speakers }, sessions] = await Promise.all([
      speakerData.load(),
      csvLoader.loadAllSessions()
    ]);
    this.data = { speakers, sessions };
    return this.data;
  }

  async search(value) {
    if (!this.results) return;
    const query = value.trim().toLowerCase();
    if (!query) {
      this.results.innerHTML = '<div class="empty-state">Start typing to search across sessions and speakers.</div>';
      return;
    }
    const { speakers, sessions } = await this.load();
    const sessionMatches = sessions.filter((session) => {
      const haystack = `${session.Session_Title} ${session.Presenter} ${session.Description} ${session.Track} ${session.Tags} ${session.Session_Type}`.toLowerCase();
      return haystack.includes(query);
    }).slice(0, 8);
    const speakerMatches = speakers.filter((speaker) => {
      const sessionText = speaker.Sessions.map((session) => session.Session_Title).join(' ');
      const haystack = `${speaker.Name} ${speaker.Credentials} ${speaker.Organization} ${speaker.Bio} ${speaker.Email} ${sessionText}`.toLowerCase();
      return haystack.includes(query);
    }).slice(0, 8);

    const html = [
      ...sessionMatches.map((session) => `
        <a class="search-result" href="${UTILS.sessionUrl(session)}">
          <span class="chip">Session</span>
          <strong>${UTILS.escapeHTML(session.Session_Title)}</strong>
          <small>${UTILS.escapeHTML(session.Day)} · ${UTILS.escapeHTML(session.Time)} · ${UTILS.escapeHTML(session.Presenter)}</small>
        </a>
      `),
      ...speakerMatches.map((speaker) => `
        <a class="search-result" href="speakers.html">
          <span class="chip">Speaker</span>
          <strong>${UTILS.escapeHTML(speaker.Name)}</strong>
          <small>${UTILS.escapeHTML(speaker.Organization || speaker.Credentials || 'Speaker')}</small>
        </a>
      `)
    ].join('');

    this.results.innerHTML = html || '<div class="empty-state">No results found.</div>';
  }
}

if (document.getElementById('site-search')) {
  new SearchController();
}
