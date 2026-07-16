class CSVLoader {
  constructor(basePath = 'data') {
    this.basePath = basePath;
    this.cache = new Map();
  }

  async loadCSV(fileName, options = {}) {
    if (this.cache.has(fileName)) return this.cache.get(fileName);
    const response = await fetch(`${this.basePath}/${fileName}`, { cache: 'no-store' });
    if (!response.ok) {
      if (options.optional) return [];
      throw new Error(`Unable to load ${fileName}`);
    }
    const text = await response.text();
    const rows = this.parseCSV(text);
    this.cache.set(fileName, rows);
    return rows;
  }

  async loadSessionDays(maxDays = 7) {
    const requests = Array.from({ length: maxDays }, (_, index) => {
      const dayNumber = index + 1;
      return this.loadCSV(`day${dayNumber}_sessions.csv`, { optional: true })
        .then((rows) => rows.length ? { dayNumber, day: `Day ${dayNumber}`, fileName: `day${dayNumber}_sessions.csv`, rows } : null);
    });
    return (await Promise.all(requests)).filter(Boolean);
  }

  async loadAllSessions() {
    const days = await this.loadSessionDays();
    return days.flatMap((day) => day.rows);
  }

  parseCSV(text) {
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\r?\n/);
    const headers = this.parseLine(lines.shift()).map((header) => header.trim());
    return lines.filter((line) => line.trim()).map((line) => {
      const values = this.parseLine(line);
      return headers.reduce((row, header, index) => {
        row[header] = (values[index] || '').trim();
        return row;
      }, {});
    });
  }

  parseLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }
}

const csvLoader = new CSVLoader();
