# SCALE Conferenec

Static digital event companion for the SCALE Conference

## Local Preview

```sh
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/index.html`.

## Data Updates

Event content is loaded from files in `data/`:

- `day1_sessions.csv`
- `day2_sessions.csv`
- `day3_sessions.csv`
- `speakers.csv`
- `venue.json`

## GitHub Pages

This repository includes a GitHub Actions workflow that publishes the static site to GitHub Pages.

