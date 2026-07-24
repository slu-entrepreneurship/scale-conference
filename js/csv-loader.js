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
      return this.loadCSV(`slu_day${dayNumber}_sessions.csv`, { optional: true })
        .then((rows) => rows.length ? { dayNumber, day: `Day ${dayNumber}`, fileName: `slu_day${dayNumber}_sessions.csv`, rows } : null);
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
    const records = this.parseRecords(trimmed);
    const headers = this.parseLine(records.shift()).map((header) => header.trim());
    return records.filter((record) => record.trim()).map((record) => {
      const values = this.parseLine(record);
      return headers.reduce((row, header, index) => {
        row[header] = values[index] || '';
        return row;
      }, {});
    });
  }

  parseRecords(text) {
    const records = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += char + text[i + 1];
          i += 1;
        } else {
          inQuotes = !inQuotes;
          current += char;
        }
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        records.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    records.push(current);
    return records;
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
