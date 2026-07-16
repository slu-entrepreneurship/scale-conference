const UTILS = {
  escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeAttribute(value) {
    return this.escapeHTML(value).replace(/`/g, '&#96;');
  },

  slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  },

  normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/dr\.|ed\.d\.|edd|ph\.d\.|phd|msw|lmsw|jd|j\.d\.|ma|m\.a\.|mba|mts|ed\.s\.|ncsp|esq\.|shrm-cp|shrm-scp|awi-ch|ascw/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  unique(values) {
    return [...new Set(values.filter(Boolean))];
  },

  linkWithProtocol(value) {
    const link = String(value || '').trim();
    if (!link) return '';
    return /^https?:\/\//i.test(link) ? link : `https://${link}`;
  },

  sessionUrl(session) {
    const day = encodeURIComponent(session.Day || '');
    const id = encodeURIComponent(session.Session_ID || '');
    const title = encodeURIComponent(session.Session_Title || '');
    return `session.html?day=${day}&id=${id}&title=${title}`;
  }
};
