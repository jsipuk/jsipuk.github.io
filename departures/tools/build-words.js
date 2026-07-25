// Builds departures/words.js from a common-English frequency list.
// Output: a compact dictionary of 3-7 letter words plus a set of 7-letter
// base words that each yield plenty of sub-words.
//
// Source list (public domain, ranked by frequency):
//   https://github.com/first20hours/google-10000-english
//   google-10000-english-usa.txt, saved next to this script as words.txt
//
// Run with:  node tools/build-words.js
const fs = require('fs');

const SRC = __dirname + '/words.txt';
const OUT = __dirname + '/../words.js';

// Words we do not want in a game children will play, plus a few that are
// simply confusing as puzzle answers (abbreviations that survive the filter).
const BLOCK = new Set(`
sex sexy sexo porn porno nude nudes naked xxx anal butt boob boobs tit tits
penis vagina dick cock cocks pussy fuck fucks fucked fucking shit shits shitty
crap damn bitch bitches bastard whore slut ass asses arse piss pissed hell
gay lesbian queer trans bdsm fetish erotic erotica orgy horny milf porne
kill kills killed killer killing murder murders rape raped rapes suicide dead
death deaths die died dying dies gun guns rifle ammo bomb bombs weapon weapons
drug drugs cocaine heroin weed cannabis meth opium booze beer wine vodka
whisky whiskey gin rum drunk tobacco cigar cigars nicotine
war wars army armed troop troops enemy enemies blood bloody wound wounds
cancer tumor tumour aids hiv virus disease illness sick sickness pain
casino poker gamble gambling bet bets betting lotto lottery
loan loans debt debts mortgage credit viagra pills pill
hate hates hated racist nazi slave slaves
topless panties breasts latinas levitra escort escorts thongs lingerie
`.trim().split(/\s+/));

// Extra words that are fine to *find* but make poor puzzle seeds: proper
// nouns, brand names, and themes better left out of a family word game.
const NOT_A_SEED = new Set(`
america andreas andrews beatles belarus belfast bradley cameron capitol
charles charlie coleman denmark estonia germany grenada iceland ireland
leonard lindsay madison melissa midwest minolta myspace newport orleans
patrick persian pontiac porsche preston raymond sherman stanley stewart
vietnam sitemap spyware deviant divorce violent threats tragedy tsunami
nuclear madness demands dispute penalty soldier mistake monster
angeles livecam webcast senegal charity suspect
`.trim().split(/\s+/));

const raw = fs.readFileSync(SRC, 'utf8').split('\n').map(w => w.trim().toLowerCase());

const seen = new Set();
const dict = [];
for (const w of raw) {
  if (!/^[a-z]{3,7}$/.test(w)) continue;
  if (BLOCK.has(w)) continue;
  if (seen.has(w)) continue;
  seen.add(w);
  dict.push(w);
}

const key = w => w.split('').sort().join('');
const canMake = (word, pool) => {
  const bag = {};
  for (const c of pool) bag[c] = (bag[c] || 0) + 1;
  for (const c of word) {
    if (!bag[c]) return false;
    bag[c]--;
  }
  return true;
};

// Candidate base words: 7 letters, at least two vowels, no more than two of
// any single letter, and a healthy number of sub-words to find.
const bases = [];
for (const w of dict) {
  if (w.length !== 7) continue;
  if (NOT_A_SEED.has(w)) continue;
  const vowels = (w.match(/[aeiou]/g) || []).length;
  if (vowels < 2 || vowels > 4) continue;
  const counts = {};
  let repeated = false;
  for (const c of w) {
    counts[c] = (counts[c] || 0) + 1;
    if (counts[c] > 2) repeated = true;
  }
  if (repeated) continue;
  const subs = dict.filter(d => d !== w && canMake(d, w));
  if (subs.length >= 18 && subs.length <= 90) bases.push([w, subs.length]);
}

bases.sort((a, b) => b[1] - a[1]);
const baseWords = bases.slice(0, 260).map(b => b[0]).sort();

const js = `/* Word list for Word Wings.
 * Derived from a public-domain frequency list of common English words,
 * filtered to 3-7 letters and screened for family-friendly play.
 * Generated - do not edit by hand.
 */
window.DeparturesWords = {
  // Every word the puzzle will accept, space separated to keep the file small.
  dict: '${dict.join(' ')}',
  // Seven-letter puzzle seeds, each with plenty of shorter words inside it.
  bases: '${baseWords.join(' ')}'
};
`;

fs.writeFileSync(OUT, js);
console.log('dictionary words:', dict.length);
console.log('base words:', baseWords.length);
console.log('sample bases:', baseWords.slice(0, 12).join(', '));
console.log('file size:', (js.length / 1024).toFixed(1) + ' KB');
