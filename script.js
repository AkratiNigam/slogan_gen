
/* SloganGen — Client-side Generative Slogan Tool */

const els = {
  brand: document.getElementById('brand'),
  desc: document.getElementById('desc'),
  industry: document.getElementById('industry'),
  tone: document.getElementById('tone'),
  length: document.getElementById('length'),
  mustInclude: document.getElementById('mustInclude'),
  avoid: document.getElementById('avoid'),
  alliteration: document.getElementById('alliteration'),
  rhyme: document.getElementById('rhyme'),
  count: document.getElementById('count'),
  generateBtn: document.getElementById('generateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  surpriseBtn: document.getElementById('surpriseBtn'),
  output: document.getElementById('output'),
  resultCount: document.getElementById('resultCount'),
  sort: document.getElementById('sort'),
  search: document.getElementById('search'),
  exportBtn: document.getElementById('exportBtn'),
  showDataset: document.getElementById('showDataset'),
  csvLoader: document.getElementById('csvLoader'),
};

let WORDS = null;
let MARKOV_DATA = [];
let RESULTS = [];
let ORIGINAL = [];

async function loadWordbanks(){
  const res = await fetch('data/wordbanks.json');
  WORDS = await res.json();
  populateIndustry();
}
function populateIndustry(){
  const ind = els.industry;
  WORDS.industries.forEach(x => {
    const opt = document.createElement('option');
    opt.value = x.id;
    opt.textContent = x.name;
    ind.appendChild(opt);
  });
  ind.value = 'generic';
}
async function loadMarkovFromCSV(url='data/slogans.csv'){
  const txt = await (await fetch(url)).text();
  const rows = txt.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  const header = rows.shift(); // slogan,industry
  const data = rows.map(r => {
    const [s, ind] = r.split(/,(.+)/); // only first comma splits slogan vs rest
    return {slogan: (s||'').replace(/^"|"$/g,''), industry:(ind||'generic').trim()};
  });
  MARKOV_DATA = data;
}

function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function chance(p){return Math.random()<p}
function normalize(s){ return s.toLowerCase().replace(/[^a-z0-9\s'-]/g,'').replace(/\s+/g,' ').trim(); }
function words(s){ return normalize(s).split(' ').filter(Boolean); }

function buildMarkovChain(lines){
  const chain = {};
  lines.forEach(line => {
    const ws = ['<START>', ...words(line), '<END>'];
    for(let i=0;i<ws.length-1;i++){
      const key = ws[i];
      const nxt = ws[i+1];
      chain[key] = chain[key] || {};
      chain[key][nxt] = (chain[key][nxt]||0)+1;
    }
  });
  return chain;
}
function generateFromChain(chain, maxWords=8){
  const out = [];
  let cur = '<START>';
  for(let i=0;i<maxWords+5;i++){
    const options = chain[cur];
    if(!options) break;
    const entries = Object.entries(options);
    const total = entries.reduce((a,[,c])=>a+c,0);
    let r = Math.random()*total;
    let next = null;
    for(const [word,count] of entries){
      r -= count;
      if(r<=0){ next = word; break; }
    }
    if(!next || next === '<END>') break;
    out.push(next);
    cur = next;
  }
  return out.join(' ');
}

function titleCase(s){
  return s.replace(/\w\S*/g, (w)=> w[0].toUpperCase() + w.slice(1));
}

function meetsLength(s, pref){
  const n = words(s).length;
  if(pref==='short') return n>=2 && n<=4;
  if(pref==='medium') return n>=4 && n<=7;
  if(pref==='long') return n>=7 && n<=12;
  return true;
}
function hasAlliteration(s, letter){
  if(!letter) return true;
  const L = letter.toLowerCase();
  const ws = words(s).slice(0,4); // check first few words
  let starters = ws.map(w=>w[0]).filter(Boolean);
  return starters.length>=2 && starters.every(c=>c===L);
}
function rhymesWith(s, tail){
  if(!tail) return true;
  const t = tail.toLowerCase().replace(/^-/,'');
  const last = words(s).slice(-1)[0] || '';
  return last.endsWith(t);
}
function includesKeywords(s, ks){
  return ks.every(k => normalize(s).includes(normalize(k)));
}
function avoidsWords(s, bads){
  return bads.every(k => !normalize(s).includes(normalize(k)));
}
function injectBrand(s, brand){
  if(!brand) return s;
  // 50% prepend or append
  if(chance(.5)) return `${brand}: ${titleCase(s)}`;
  return `${titleCase(s)} — ${brand}`;
}

// Scoring: power words, brevity, end-rhyme, rhythm (avg word length 4-6), contains industry term
function scoreSlogan(s, {industryId, rhymeTail}){
  const ws = words(s);
  let score = 0;
  const power = new Set(WORDS.power_words);
  score += ws.filter(w=>power.has(w)).length * 2;
  const n = ws.length;
  score += (n<=6 ? 3 : (n<=9 ? 1 : 0));
  if(rhymeTail && rhymesWith(s, rhymeTail)) score += 1.5;
  const avgLen = ws.reduce((a,w)=>a+w.length,0) / Math.max(1, n);
  score += (avgLen>3.5 && avgLen<6.5) ? 1 : 0;
  const indWords = new Set((WORDS.industries.find(i=>i.id===industryId)?.keywords||[]).map(k=>k.toLowerCase()));
  score += ws.filter(w=>indWords.has(w)).length * 0.5;
  return Math.round(score*10)/10;
}

function combineTemplate({brand, desc, industryId, tones, lengthPref}){
  const i = WORDS.industries.find(x=>x.id===industryId) || WORDS.industries[0];
  const power = WORDS.power_words;
  const verbs = WORDS.verbs;
  const benefits = i.benefits;
  const outcomes = WORDS.outcomes;
  const toneWord = tones.length ? pick(tones) : null;

  // simple templates
  const tpls = [
    () => `${pick(power)} ${pick(benefits)}. ${pick(outcomes)}`,
    () => `${pick(verbs)} ${pick(benefits)} ${pick(power)}`,
    () => `${pick(benefits)} without the ${pick(WORDS.negatives)}`,
    () => `${pick(power)} ${pick(i.keywords)}. ${pick(benefits)}`,
    () => `${pick(power)} results for ${pick(i.audience)}`,
    () => `${pick(verbs)} more, ${pick(verbs)} smarter, ${pick(verbs)} ${pick(i.keywords)}`,
    () => `${pick(power)} ${pick(benefits)} for ${pick(i.audience)}`,
  ];

  let base = pick(tpls)();
  if(desc && chance(.5)){
    const descKey = words(desc).slice(0,3).join(' ');
    base = base.replace(/\.$/,'') + ` for ${descKey}`;
  }
  if(toneWord && chance(.5)) base = `${toneWord} • ${base}`;
  // adjust to target length by trimming words
  const w = words(base);
  const target = lengthPref==='short'? 4 : lengthPref==='long'? 10 : 7;
  if(w.length>target) base = w.slice(0,target).join(' ');
  return titleCase(base);
}

function chainForIndustry(industryId){
  const lines = MARKOV_DATA
    .filter(r => r.industry===industryId || r.industry==='generic')
    .map(r => r.slogan);
  if(lines.length < 5){
    return buildMarkovChain(MARKOV_DATA.map(r=>r.slogan));
  }
  return buildMarkovChain(lines);
}

function generateCandidates(opts){
  const out = [];
  const {lengthPref, industryId} = opts;
  const chain = chainForIndustry(industryId);
  const attempts = 200;
  for(let i=0;i<attempts;i++){
    let s = chance(.45) ? generateFromChain(chain, lengthPref==='long'?12:8) : combineTemplate(opts);
    s = s.replace(/\s{2,}/g,' ').trim();
    if(/\w$/.test(s)) s += chance(.2)?'!':'';
    out.push(s);
  }
  return Array.from(new Set(out)); // uniqueness
}

function applyConstraints(list, {lengthPref, allit, rhymeTail, must, avoid, industryId}){
  return list.filter(s =>
    meetsLength(s, lengthPref) &&
    hasAlliteration(s, allit) &&
    rhymesWith(s, rhymeTail) &&
    includesKeywords(s, must) &&
    avoidsWords(s, avoid)
  ).map(s => ({
    text: s,
    score: scoreSlogan(s, {industryId, rhymeTail})
  }));
}

function render(){
  const term = els.search.value.trim().toLowerCase();
  let list = [...RESULTS];
  if(term) list = list.filter(x => x.text.toLowerCase().includes(term));

  const mode = els.sort.value;
  if(mode==='score') list.sort((a,b)=>b.score-a.score);
  if(mode==='length') list.sort((a,b)=>words(a.text).length - words(b.text).length);
  if(mode==='alpha') list.sort((a,b)=>a.text.localeCompare(b.text));
  if(mode==='custom') list = [...ORIGINAL].filter(x => list.find(y=>y.text===x.text));

  els.resultCount.textContent = list.length ? `(${list.length} shown)` : '(no matches)';
  els.output.innerHTML = '';

  list.forEach(({text, score}) => {
    const div = document.createElement('div');
    div.className = 'slogan';
    const left = document.createElement('div');
    left.className = 'text';
    left.textContent = text;
    const right = document.createElement('div');
    right.className = 'meta';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.title = 'Punch Score';
    badge.textContent = `★ ${score.toFixed(1)}`;

    const copy = document.createElement('button');
    copy.className = 'btn ghost';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied!';
      setTimeout(()=>copy.textContent='Copy', 1000);
    });

    right.appendChild(badge);
    right.appendChild(copy);
    div.appendChild(left);
    div.appendChild(right);
    els.output.appendChild(div);
  });
}

function getSelectedTones(){
  return Array.from(els.tone.selectedOptions).map(o => o.value);
}

function parseCSVFile(file){
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const txt = reader.result;
      const rows = txt.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
      rows.shift(); // header
      const data = rows.map(r => {
        const [s, ind] = r.split(/,(.+)/);
        return {slogan:(s||'').replace(/^"|"$/g,''), industry:(ind||'generic').trim()};
      });
      resolve(data);
    };
    reader.readAsText(file);
  });
}

function exportResults(){
  if(!RESULTS.length){ alert('No results to export yet.'); return; }
  const rows = RESULTS.map(x => ({slogan:x.text, score:x.score}));
  const csv = ['slogan,score', ...rows.map(r => `"${r.slogan.replace(/"/g,'""')}",${r.score}`)].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'slogans_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function surpriseMe(){
  const sampleBrands = ['Nimbus Shoes','Aurora Coffee','Quanta Cloud','Evergreen Clean','Pulse Fitness','Nova Solar'];
  const sampleDesc = ['breathable running shoes with adaptive cushioning','small-batch coffee roasted fresh','cloud platform for growing startups','eco-friendly household cleaning','smart workouts that fit your day','affordable rooftop solar systems'];
  const ids = WORDS.industries.map(i=>i.id);
  els.brand.value = pick(sampleBrands);
  els.desc.value = pick(sampleDesc);
  els.industry.value = pick(ids);
  els.tone.selectedIndex = -1;
  ['bold','playful','innovative'].forEach(v => {
    const opt = Array.from(els.tone.options).find(o=>o.value===v);
    if(opt) opt.selected = true;
  });
  els.length.value = pick(['short','medium','long']);
  els.mustInclude.value = pick([ '', 'fast, light', 'clean', 'secure', 'green', 'coffee' ]);
  els.avoid.value = pick([ '', 'cheap', 'boring', 'slow' ]);
  els.alliteration.value = pick(['','F','S','N','C']);
  els.rhyme.value = pick(['','-ow','-ite','-een']);
  els.count.value = pick([8,12,16,20]);
}

async function main(){
  await loadWordbanks();
  await loadMarkovFromCSV();

  els.generateBtn.addEventListener('click', async () => {
    const opts = {
      brand: els.brand.value.trim(),
      desc: els.desc.value.trim(),
      industryId: els.industry.value || 'generic',
      tones: getSelectedTones(),
      lengthPref: els.length.value,
      must: els.mustInclude.value.split(',').map(s=>s.trim()).filter(Boolean),
      avoid: els.avoid.value.split(',').map(s=>s.trim()).filter(Boolean),
      allit: (els.alliteration.value||'').toLowerCase(),
      rhymeTail: (els.rhyme.value||'').toLowerCase().replace(/^-/,''),
      count: Math.max(1, Math.min(50, parseInt(els.count.value||'12',10)))
    };

    const cands = generateCandidates(opts);
    const constrained = applyConstraints(cands, {
      lengthPref: opts.lengthPref,
      allit: opts.allit,
      rhymeTail: opts.rhymeTail,
      must: opts.must,
      avoid: opts.avoid,
      industryId: opts.industryId
    });

    const withBrand = constrained
      .sort((a,b)=>b.score-a.score)
      .slice(0, Math.max(opts.count*2, opts.count+8))
      .map(x => ({ ...x, text: injectBrand(x.text, opts.brand) }))
      .slice(0, opts.count);

    RESULTS = withBrand;
    ORIGINAL = [...withBrand];
    render();
    window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
  });

  els.clearBtn.addEventListener('click', () => {
    RESULTS = [];
    ORIGINAL = [];
    els.output.innerHTML = '';
    els.resultCount.textContent = '';
  });

  els.surpriseBtn.addEventListener('click', surpriseMe);
  els.sort.addEventListener('change', render);
  els.search.addEventListener('input', render);
  els.exportBtn.addEventListener('click', exportResults);
  els.showDataset.addEventListener('click', () => {
    alert('Open /data/wordbanks.json and /data/slogans.csv to edit or extend the dataset. You can also import a CSV via "Load Custom CSV".');
  });
  els.csvLoader.addEventListener('change', async (e) => {
    if(!e.target.files?.length) return;
    const file = e.target.files[0];
    const data = await parseCSVFile(file);
    // merge and rebuild MARKOV_DATA
    MARKOV_DATA = [...MARKOV_DATA, ...data];
    alert(`Loaded ${data.length} custom rows. Future generations will use them.`);
  });
}

main();
