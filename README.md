# SloganGen — AI Marketing Slogan Generator (Static Website)

A lightweight, privacy‑friendly slogan generator that runs entirely in the browser using HTML/CSS/JS. No server, no tracking. Drop the folder on any static host (GitHub Pages, Netlify, Vercel, S3).

## Features
- Client‑side Markov chain + template fusion for high‑quality slogans
- Controls: industry, tone, length, keywords to include/avoid, alliteration, rhyme ending
- Scoring & sorting by "Punch Score"
- Import your own CSV dataset to bias the model
- Export generated results to CSV
- MIT licensed

## Structure
```
slogan-gen/
├─ index.html
├─ assets/
│  ├─ style.css
│  └─ script.js
└─ data/
   ├─ wordbanks.json
   └─ slogans.csv
```

## Local Development
Just open `index.html` in your browser. For best results, serve with a local static server:

```bash
# python 3
python -m http.server 8080
# or
npx http-server . -p 8080
```

Then browse to `http://localhost:8080/slogan-gen/` if serving from the parent directory.

## Custom Dataset
Provide a CSV with header `slogan,industry`. Example:
```csv
slogan,industry
"Epic flavor, zero fuss",food
"Scale fast, sleep well",tech
```
Use industries: generic, fitness, food, tech, eco, fashion, finance — or define your own IDs and reference them in your slogans.

## License
MIT — do whatever, but no warranty.
