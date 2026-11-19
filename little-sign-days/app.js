'use strict';
const {words,routines,games,sources}=window.LEARN;
const demos={more:'eTn9Fmmpw_U',drink:'JIVIS1IATmk',eat:'kLFwK1-einI',finished:'rcj4Y_Y54NQ',again:'lBdskVV-19I',play:'K7tY5b51I_Y',wash:'FjTkUMu1Jvk',sleep:'ivRzXoAgiE8',milk:'VVE0AqexE5o',help:'uBTE91RWM5g',stop:'ecWOhmeC9pM'};
const diagrams = {
  "more": {
    "image": "https://www.ascleader.co.uk/pluginfile.php/14144/mod_page/content/5/more.PNG",
    "source": "https://www.ascleader.co.uk/mod/page/view.php?id=4721",
    "publisher": "ASC LeadER",
    "note": "Follow the movement arrow on the diagram."
  },
  "drink": {
    "image": "https://www.mencap.org.uk/sites/default/files/styles/easyread_image/public/2024-10/Makaton%20Sign%20-%20To%20Drink.png?itok=O3Kk2Qdg",
    "source": "https://www.mencap.org.uk/resource/signs-and-symbols",
    "publisher": "Mencap",
    "note": "Use the cupped hand shape shown and tip your head back a little, as if drinking."
  },
  "eat": {
    "image": "https://www.mencap.org.uk/sites/default/files/styles/easyread_image/public/2024-10/Makaton%20Sign%20-%20To%20Eat.png?itok=QblJ0uXt",
    "source": "https://www.mencap.org.uk/resource/signs-and-symbols",
    "publisher": "Mencap",
    "note": "Touch your lips twice, as shown in the diagram. Say “eat” as you sign."
  },
  "finished": {
    "image": "https://www.mencap.org.uk/sites/default/files/styles/easyread_image/public/2024-10/Makaton%20Sign%20To%20finish%20or%20All%20gone.png?itok=IGEPHAK6",
    "source": "https://www.mencap.org.uk/resource/signs-and-symbols",
    "publisher": "Mencap",
    "note": "This diagram is labelled “To Finish / All Gone”."
  },
  "sleep": {
    "image": "https://www.ypo.co.uk/-/media/latest-news/blogs/2023/sleep_makaton.ashx",
    "source": "https://www.ypo.co.uk/news-and-events/blog/ten-easy-to-learn-makaton-signs",
    "publisher": "YPO",
    "note": "Use the illustration alongside the video to check the hand position."
  },
  "help": {
    "image": "https://newfield.org.uk/perch/resources/help-w1200.png",
    "source": "https://newfield.org.uk/blog/2019-11-18-makaton-signs-of-the-week-181119",
    "publisher": "Newfield School",
    "note": "The arrow shows the direction of the movement."
  },
  "milk": {
    "image": "https://makaton.org/images/TMC/ProductImages/SO_PIBO/AMR10020_3.png",
    "source": "https://makaton.org/ItemDetail?iProductCode=AMR10020",
    "publisher": "The Makaton Charity · My First Signs preview",
    "note": "The publisher’s illustrated example of “Milk”."
  },
  "play": {
    "image": "https://www.portesbery.surrey.sch.uk/i/photo-grid-slideshows/makaton_signs/2_Play.jpeg",
    "source": "https://www.portesbery.surrey.sch.uk/Children/Makaton/",
    "publisher": "Portesbery School",
    "note": "Follow the arrows beside both hands."
  },
  "wash": {
    "image": "https://www.ascleader.co.uk/pluginfile.php/15155/mod_page/content/6/wash.PNG",
    "source": "https://www.ascleader.co.uk/mod/page/view.php?id=5143",
    "publisher": "ASC LeadER",
    "note": "This hand-washing diagram is labelled “Wash”."
  },
  "again": {
    "image": "https://makaton.org/images/TMC/ProductImages/SS_USMA/ZSOC10139W_2.png",
    "source": "https://makaton.org/TMC/TMC/Store/Product_Display_Stories_Songs_Nursery%20_Rhymes.aspx?Category=SS_USMA&iProductCode=ZSOC10139W",
    "publisher": "The Makaton Charity · Bear Hunt resource preview",
    "note": "Find “Again” at the start of this labelled sheet. Enlarge to see the hand position.",
    "sheet": true
  },
  "stop": {
    "image": "https://springwellschool.net/i/Signs_of_the_week/Signs_of_the_week_5.jpg",
    "source": "https://springwellschool.net/Resources/",
    "publisher": "Springwell School",
    "note": "Find the diagram labelled “Stop” on this sheet. Enlarge to see the movement arrow.",
    "sheet": true
  }
};
const glyphs={
 home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
 book:'<path d="M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 5v15"/>',
 family:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6m2 3c3 1 4 3 4 6"/>',
 save:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',left:'<path d="M20 12H5m6-6-6 6 6 6"/>',
 spark:'<path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/>',
 more:'<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8m-4-4v8"/>',
 drink:'<path d="m5 6 2 14h10l2-14zm1 5h12m-6-6 2-4h4"/>',
 milk:'<path d="M7 6h10l2 5v10H5V11zm0 0V3h10v3m-5 0 2 5v10M5 11h14"/>',
 eat:'<path d="M5 3v6m3-6v6m3-6v6c0 3-6 3-6 0m3 2v10m10-18c-4 3-4 8 0 9v9m0-18v9"/>',
 finished:'<path d="m4 12 5 5L20 6"/>',again:'<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
 play:'<path d="m7 3 14 9-14 9z"/>',wash:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/>',
 sleep:'<path d="M20 15A9 9 0 0 1 9 3 9 9 0 1 0 20 15z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
 stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 close:'<path d="m6 6 12 12m0-12L6 18"/>',external:'<path d="M13 4h7v7m0-7L10 14m-1-9H4v15h15v-5"/>',
 layers:'<path d="m3 8 9-5 9 5-9 5zm1 5 8 5 8-5m-16 5 8 4 8-4"/>'};
const icon=k=>'<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">'+glyphs[k]+'</svg>';
const main = document.querySelector('main');
const modal = document.querySelector('dialog');
const detail = document.querySelector('#detail');
const word = id => words.find(item => item.id === id);
const navItems = [['home', 'home', 'Home'], ['library', 'book', 'Sign library'], ['siblings', 'family', 'Sibling corner']];
const snackWords = ['drink', 'more', 'finished'];
const situations = [
 {label: 'They want more', id: 'more'},
 {label: 'They’ve had enough', id: 'finished'},
 {label: 'They need help', id: 'help'},
 {label: 'Another go?', id: 'again'},
 {label: 'Time for a drink', id: 'drink'},
 {label: 'They want to stop', id: 'stop'}
];
let storageAvailable = true;
function readStored(key, fallback) {
 let raw;
 try { raw = localStorage.getItem(key); }
 catch { storageAvailable = false; return fallback; }
 if (raw === null) return fallback;
 try { return JSON.parse(raw); } catch { return fallback; }
}
function validSaved(value) {
 return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && word(id)))] : [];
}
let saved = validSaved(readStored('lsd.saved', ['more', 'drink', 'milk', 'finished', 'help']));
const storedPractice = readStored('lsd.practice', {});
let familiarity = {};
for (const item of words) {
 if (storedPractice && ['again', 'comfortable'].includes(storedPractice[item.id])) {
  familiarity[item.id] = storedPractice[item.id];
 }
}
let search = '';
let homeSearch = '';
let filter = 'all';
let snackStep = 0;
let siblingLevel = 'together';
let practiceIds = [];
let practiceIndex = 0;
let practiceRevealed = false;
let noticeTimer;
let diagramTimer;
let offlineReady = false;
let modalOrigin = 'home';
let returnSign = '';
function saveLocal(key, value) {
 try {
  localStorage.setItem(key, JSON.stringify(value));
  storageAvailable = true;
  return true;
 } catch {
  storageAvailable = false;
  return false;
 }
}
function head(title, description) {
 return '<div class="pagehead"><h1>'+title+'</h1><p>'+description+'</p></div>';
}
function section(title, body, action = '') {
 return '<section class="section"><div class="section-title"><h2>'+title+'</h2>'+action+'</div>'+body+'</section>';
}
function link(url, label) {
 return '<a href="#'+url+'">'+label+' '+icon('arrow')+'</a>';
}
function back(url, label) {
 return '<a class="back" href="#'+url+'">'+icon('left')+label+'</a>';
}
function searchBox(id) {
 return '<label class="search">'+icon('search')+'<input type="search" id="'+id+'" aria-label="Search signs" placeholder="Find a sign…"></label>';
}
function cards(ids) {
 return '<div class="words">'+ids.map(id => {
  const item = word(id);
  const selected = saved.includes(id);
  return '<article class="word"><button class="word-main" data-sign="'+id+'"><span class="token color'+(words.indexOf(item)%4)+'">'+icon(id)+'</span><span><strong>'+item.name+'</strong><small>'+item.group+'</small></span></button><button class="mark '+(selected ? 'marked' : '')+'" data-save="'+id+'" aria-label="'+(selected ? 'Unpin ' : 'Pin ')+item.name+'" aria-pressed="'+selected+'">'+icon('save')+'</button></article>';
 }).join('')+'</div>';
}
function home() {
 const quick = saved.length ? cards(saved) : '<div class="empty"><p>Pin the signs your family uses most to find them here.</p>'+link('library', 'Choose signs')+'</div>';
 return head('Your family dashboard', 'A sign for the moment you’re in.')+
 searchBox('home-search')+'<div id="home-results" hidden></div>'+
 '<div id="home-content">'+section('Your essentials', quick, link('library', 'Choose signs'))+
 section('What’s happening?', '<div class="situations">'+situations.map(s =>
  '<button class="situation" data-sign="'+s.id+'">'+s.label+' '+icon('arrow')+'</button>').join('')+'</div>')+
 '<section class="hero"><img class="hero-image" src="snack.webp" alt="A little cup and a bowl of porridge with fruit"><div class="hero-copy"><span class="badge">'+icon('spark')+' Featured routine</span><h2>Signs for snack time</h2><p>Practise three signs for offering a drink, asking for more and finishing a snack.</p><a class="btn primary" href="#snack">Explore routine '+icon('arrow')+'</a></div></section>'+
 section('Everyday routines', '<div class="routines">'+routines.map(r =>
  '<a href="#routine/'+r.id+'" class="routine '+r.id+'"><img src="'+r.id+'.png" alt=""><strong>'+r.name+'</strong><small>'+r.words.length+' signs '+icon('arrow')+'</small></a>').join('')+'</div>')+
 '<div class="panel practice-invite"><div><h2>A quick refresher</h2><p>Recall up to three of your pinned signs, then check the diagrams.</p></div><button class="btn primary" data-practice>Practise your signs '+icon('arrow')+'</button></div></div>';
}
function matchingWords(query, routineId = 'all') {
 const routine = routines.find(r => r.id === routineId);
 const text = query.toLocaleLowerCase().trim();
 return words.filter(item => (!routine || routine.words.includes(item.id)) &&
  (item.name+' '+item.group+' '+item.phrase+' '+item.when).toLocaleLowerCase().includes(text)).map(item => item.id);
}
function resultCards(ids) {
 return ids.length ? cards(ids) : '<div class="empty"><p>No signs match. Try “milk”, “more” or “help”.</p><button class="btn secondary" data-clear>Clear search</button></div>';
}
function updateHomeResults() {
 const results = main.querySelector('#home-results');
 if (!results) return;
 results.hidden = !homeSearch.trim();
 main.querySelector('#home-content').hidden = Boolean(homeSearch.trim());
 results.innerHTML = homeSearch.trim() ? resultCards(matchingWords(homeSearch)) : '';
}
function library() {
 return head('Sign library', 'Choose a sign to see its diagram and a phrase to use.')+
 searchBox('search')+'<div class="filters" aria-label="Filter by routine">'+
 [['all', 'All signs'], ...routines.map(r => [r.id, r.name])].map(([id, name]) =>
  '<button class="chip '+(id === filter ? 'on' : '')+'" data-filter="'+id+'" aria-pressed="'+(id === filter)+'">'+name+'</button>').join('')+
 '</div><p id="result-count" class="sr-only" role="status"></p><div id="results">'+resultCards(matchingWords(search, filter))+'</div>';
}
function routineView(routine) {
 return back('home', 'Dashboard')+'<div class="routine-head '+routine.id+'"><img src="'+routine.id+'.png" alt=""><div><h1>'+routine.name+'</h1><p>'+routine.intro+'</p></div></div>'+
 section('Signs for this moment', cards(routine.words))+'<div class="panel"><h2>Try it together</h2><p>'+routine.activity+'</p></div>';
}
function snack() {
 const item = word(snackWords[snackStep]);
 return back('home', 'Dashboard')+head('Signs for snack time', 'Pick the moment you need now, or work through all three.')+
 '<div class="filters">'+snackWords.map((id, index) =>
  '<button class="chip '+(index === snackStep ? 'on' : '')+'" data-step="'+index+'" aria-pressed="'+(index === snackStep)+'">'+(index+1)+'. '+word(id).name+'</button>').join('')+
 '</div><div class="panel"><span class="label">Moment '+(snackStep+1)+' of 3</span><h2>'+item.phrase+'</h2><p>'+item.when+' '+item.respond+'</p><div class="stepbar"><button class="btn primary" data-sign="'+item.id+'">'+icon('book')+' See the sign</button>'+
 (snackStep < 2 ? '<button class="btn secondary" data-step="'+(snackStep+1)+'">Next moment '+icon('arrow')+'</button>' : '<a class="btn secondary" href="#home">Back to dashboard</a>')+'</div></div>';
}
const youngerSteps = [
 ['Ask a grown-up to show you “more”. Sit together with a soft ball.', 'Roll the ball gently to your little brother or sister.', 'Say and sign “More?” together. Roll again if they reach for it. Let them stop when they want.'],
 ['Ask a grown-up to show you “again”. Hide your own face with your hands.', 'Pop out and say “Peekaboo!”', 'Ask “Again?” and sign with the grown-up. Watch to see whether your little brother or sister wants another go.'],
 ['Ask a grown-up to show you “sleep”. Find a teddy.', 'Put Teddy down and say “Time to sleep”. Sign together.', 'See what your little brother or sister does. They can join the game in their own way.']
];
function siblingSelector() {
 return '<div class="filters" aria-label="Sibling activity level">'+
 [['together', 'With a grown-up'], ['lead', 'I can lead the game']].map(([id, label]) =>
  '<button class="chip '+(siblingLevel === id ? 'on' : '')+'" data-level="'+id+'" aria-pressed="'+(siblingLevel === id)+'">'+label+'</button>').join('')+'</div>';
}
function siblings() {
 return head('Sibling corner', 'Small games for big brothers, big sisters and their grown-ups.')+siblingSelector()+
 '<div class="games">'+games.map((game, index) =>
  '<article class="game"><img src="'+(index === 2 ? 'bed' : 'play')+'.png" alt=""><span class="label">Practise '+word(game.word).name.toLowerCase()+'</span><h3>'+game.name+'</h3><p>'+game.intro+'</p><a class="btn primary" href="#game/'+index+'">Play together '+icon('arrow')+'</a></article>').join('')+'</div>';
}
function gameView(game, index) {
 const steps = siblingLevel === 'together' ? youngerSteps[index] : game.steps;
 return back('siblings', 'Sibling corner')+head(game.name, game.intro)+siblingSelector()+
 '<div class="panel"><h2>How to play</h2><ol class="game-steps">'+steps.map(step => '<li>'+step+'</li>').join('')+
 '</ol><button class="btn primary" data-sign="'+game.word+'">'+icon('book')+' See '+word(game.word).name.toLowerCase()+'</button></div>';
}
function guide() {
 return head('Learning guide', 'A starting point for using UK Makaton at home.')+
 '<div class="panel guide"><h2>Start with one word</h2><p>Makaton uses speech, signs and symbols to support communication. Pick a word that matters to your child today. Check its demonstration, then put the phone down and use it together.</p>'+
 '<details open><summary>When you’re with your one-year-old</summary><p>Follow what catches their eye. Say a short phrase naturally and sign its key word. Pause so they have time to take a turn. A glance, a reach or a sound can tell you what they want. Offer the food, toy or help without waiting for them to copy.</p></details>'+
 '<details><summary>Learning as a family</summary><p>Pin a few words you want to use often. The practice activity asks you to recall up to three pinned signs. “Practise again” and “Comfortable” record your own confidence and help choose what to revisit. Sibling games have options for joining a grown-up or reading the steps independently.</p></details>'+
 '<details open><summary>Your saved signs and offline access</summary><p>Pinned signs and practice choices are stored in this browser on this device. Clearing browser data removes them. Another device starts with its own list.</p><p>After the hosted app has finished saving for offline use, routines and activities work without a connection. Publisher diagrams are saved after they load successfully. Open the signs you need while online first. Videos and source websites need a connection. Your browser may clear its offline storage when space is limited.</p><p>The downloaded HTML copy includes the routines and activities. Automatic image caching is available in the hosted app.</p><p id="offline-detail">'+offlineDescription()+'</p></details>'+
 '<details><summary>Sources and privacy</summary><p>This independent family guide uses UK Makaton. Published diagrams retain their source credits. Again and Stop currently use labelled reference sheets. The app loads these images from the publishers, which receive the image request. Opening a video takes you to YouTube. Family choices stay in your browser.</p><ul>'+
 sources.map(source => '<li><a href="'+source.url+'" target="_blank" rel="noopener noreferrer">'+source.name+'</a> — '+source.detail+'</li>').join('')+
 '<li><a href="https://makaton.org/TMC/TMC/Learn_Makaton/Other_workshops/MSB.aspx" target="_blank" rel="noopener noreferrer">The Makaton Charity’s Signing for Babies and Families workshops</a></li></ul></details></div>';
}
function practice() {
 if (!practiceIds.length) {
  return back('home', 'Dashboard')+head('Your quick refresher', 'Practise a few of your pinned signs.')+
   '<div class="panel"><p>Pin signs in the library, then start a refresher.</p><button class="btn primary" data-practice>Start refresher</button> '+link('library', 'Choose signs')+'</div>';
 }
 if (practiceIndex >= practiceIds.length) {
  return back('home', 'Dashboard')+head('Ready to use together', 'Choose one of those signs for your next everyday moment.')+
   '<div class="panel"><h2>Take it into your day</h2><p>Use the word when it fits, pause, and respond to your little one.</p><button class="btn secondary" data-practice>Practise another set</button></div>';
 }
 const item = word(practiceIds[practiceIndex]);
 return back('home', 'Dashboard')+head('Can you remember “'+item.name.toLowerCase()+'”?', 'Your practice · '+(practiceIndex+1)+' of '+practiceIds.length)+
 '<div class="panel"><p>Try the sign yourself, then check the diagram or demonstration.</p>'+
 (practiceRevealed ? '<button class="btn primary" data-sign="'+item.id+'">Check the sign '+icon('book')+'</button><p>How did that feel?</p><div class="stepbar"><button class="btn secondary" data-confidence="again">Practise again</button><button class="btn primary" data-confidence="comfortable">Comfortable</button></div>' :
 '<button class="btn primary" data-reveal>Reveal the sign '+icon('arrow')+'</button>')+'</div>';
}
function startPractice() {
 practiceIds = [...saved].sort((a,b) => Number(familiarity[a] === 'comfortable') - Number(familiarity[b] === 'comfortable')).slice(0,3);
 practiceIndex = 0;
 practiceRevealed = false;
 if (!practiceIds.length) {
  notify('Pin a sign to start practising.');
  location.hash = 'library';
  return;
 }
 if (location.hash === '#practice') render();
 else location.hash = 'practice';
}
function route() {
 return location.hash.slice(1).split('/');
}
function render() {
 let [page = 'home', id] = route();
 if (page === 'sign') [page, id] = modalOrigin.split('/');
 const active = page === 'game' ? 'siblings' : ['routine', 'snack', 'practice', ''].includes(page) ? 'home' : page;
 document.querySelector('#nav').innerHTML = navItems.map(([url, glyph, label]) =>
  '<a href="#'+url+'" '+(url === active ? 'class="active" aria-current="page"' : '')+'>'+icon(glyph)+label+'</a>').join('');
 const savedLink = document.querySelector('#savedlink');
 savedLink.innerHTML = icon('save')+'Saved'+(saved.length ? ' ('+saved.length+')' : '');
 savedLink.classList.toggle('active', page === 'saved');
 savedLink.removeAttribute('aria-current');
 if (page === 'saved') savedLink.setAttribute('aria-current', 'page');
 const routine = routines.find(item => item.id === id);
 if (page === 'library') {
  main.innerHTML = library();
  main.querySelector('#search').value = search;
 } else if (page === 'saved') {
  main.innerHTML = head('Saved signs', 'Pinned on your home screen and saved in this browser.')+
   (saved.length ? cards(saved)+'<div class="section"><button class="btn primary" data-practice>Practise your signs</button></div>' :
    '<div class="empty"><p>Pin signs from the library to keep them here.</p>'+link('library', 'Browse signs')+'</div>');
 } else if (page === 'routine' && routine) main.innerHTML = routineView(routine);
 else if (page === 'snack') main.innerHTML = snack();
 else if (page === 'siblings') main.innerHTML = siblings();
 else if (page === 'game' && /^\d+$/.test(id) && games[id]) main.innerHTML = gameView(games[id], Number(id));
 else if (page === 'guide') main.innerHTML = guide();
 else if (page === 'practice') main.innerHTML = practice();
 else main.innerHTML = home();
 const homeInput = main.querySelector('#home-search');
 if (homeInput) {
  homeInput.value = homeSearch;
  updateHomeResults();
 }
 document.title = main.querySelector('h1').textContent+' · Little Sign Days';
 updateConnection();
}
function diagramPanel(id) {
 const diagram = diagrams[id];
 return '<figure class="sign-diagram"><div class="diagram-heading"><h3>How to sign '+word(id).name.toLowerCase()+'</h3><button class="btn secondary diagram-zoom" data-zoom aria-pressed="false" disabled>Enlarge</button></div><p>'+diagram.note+'</p><div class="diagram-viewport" tabindex="0" aria-label="Sign diagram. Scroll to inspect when enlarged."><img class="diagram-image" alt="Published UK Makaton '+word(id).name+' '+(diagram.sheet ? 'reference sheet' : 'sign diagram')+'" src="'+diagram.image+'" referrerpolicy="no-referrer"></div><p class="diagram-status" role="status">Loading the diagram…</p><button class="btn secondary diagram-retry" data-retry hidden>Try loading again</button><figcaption><a href="'+diagram.source+'" target="_blank" rel="noopener noreferrer">Source · '+diagram.publisher+' '+icon('external')+'</a><span>Makaton line drawings © The Makaton Charity.</span></figcaption></figure>';
}
function attachDiagramEvents() {
 clearTimeout(diagramTimer);
 const img = detail.querySelector('.diagram-image');
 const status = detail.querySelector('.diagram-status');
 const zoom = detail.querySelector('[data-zoom]');
 const retry = detail.querySelector('[data-retry]');
 function loaded() {
  if (!img.isConnected) return;
  clearTimeout(diagramTimer);
  status.hidden = true;
  img.hidden = false;
  zoom.disabled = false;
  retry.hidden = true;
 }
 function failed() {
  if (!img.isConnected) return;
  clearTimeout(diagramTimer);
  status.hidden = false;
  status.textContent = 'The diagram could not load. Try again or open its source below.';
  if (!navigator.onLine) {
   status.textContent = window.STANDALONE || location.protocol === 'file:' ?
    'This diagram needs an internet connection in the downloaded copy.' :
    'This diagram is not available offline yet. Open it while online to save it for next time.';
  }
  img.hidden = true;
  zoom.disabled = true;
  retry.hidden = false;
  if (navigator.serviceWorker?.controller) {
   navigator.serviceWorker.controller.postMessage({type: 'REMOVE_FAILED_IMAGE', url: diagrams[modal.dataset.word].image});
  }
 }
 img.addEventListener('load', loaded, {once: true});
 img.addEventListener('error', failed, {once: true});
 diagramTimer = setTimeout(failed, 12000);
 if (img.complete) img.naturalWidth ? loaded() : failed();
}
function showSign(id, retry = false) {
 const item = word(id);
 if (!item) return;
 clearTimeout(diagramTimer);
 const publisher = id === 'play' ? 'The Makaton Charity' : id === 'finished' ? 'SEND Early Identification and Support Services' : 'Makaton with Lucinda';
 modal.dataset.word = id;
 modal.setAttribute('aria-labelledby', 'sign-title');
 detail.innerHTML = '<div class="modalbar"><span class="badge">'+icon('book')+' Sign refresher</span><button class="close" data-close aria-label="Close refresher">'+icon('close')+'</button></div>'+
 '<h2 id="sign-title" class="modal-title">'+item.name+'</h2><p class="quote">“'+item.phrase+'”</p>'+
 diagramPanel(id)+'<div class="demobox"><a class="btn primary" href="https://www.youtube.com/watch?v='+demos[id]+'" target="_blank" rel="noopener noreferrer">'+icon('play')+' Watch the sign '+icon('external')+'</a><small>Online · YouTube · '+publisher+'</small></div>'+
 '<div class="instructions"><span class="label">When to use it</span><p>'+item.when+'</p><span class="label">Give them a turn</span><p>'+item.respond+'</p></div>'+
 '<div class="modal-actions"><button class="btn secondary savebtn" data-save="'+id+'"></button><button class="btn primary" data-close>Done</button></div>';
 updateSaveButtons();
 if (retry) {
  const url = new URL(diagrams[id].image, location.href);
  url.searchParams.set('_lsd_retry', Date.now());
  detail.querySelector('.diagram-image').src = url.href;
 }
 attachDiagramEvents();
 if (!modal.open) modal.showModal();
 modal.scrollTop = 0;
 detail.querySelector('.close').focus({preventScroll: true});
}
function openSign(id) {
 if (!word(id)) return;
 returnSign = id;
 if (route()[0] !== 'sign') modalOrigin = location.hash.slice(1) || 'home';
 history.pushState({signOverlay: true, origin: modalOrigin}, '', '#sign/'+id);
 showSign(id);
}
function closeSign() {
 if (!modal.open) return;
 clearTimeout(diagramTimer);
 if (history.state?.signOverlay) {
  history.back();
 } else {
  history.replaceState(null, '', '#'+modalOrigin);
  syncRoute();
 }
}
function updateSaveButtons() {
 document.querySelectorAll('[data-save]').forEach(button => {
  const id = button.dataset.save;
  const selected = saved.includes(id);
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', (selected ? 'Unpin ' : 'Pin ')+word(id).name);
  button.classList.toggle('marked', selected);
  button.innerHTML = icon('save')+(button.classList.contains('savebtn') ? selected ? 'Pinned · Unpin' : 'Pin this sign' : '');
 });
}
function notify(message) {
 const el = document.querySelector('#notice');
 el.textContent = message;
 clearTimeout(noticeTimer);
 noticeTimer = setTimeout(() => el.textContent = '', 3500);
}
function offlineDescription() {
 if (location.protocol === 'file:' || window.STANDALONE) return 'This is the downloaded copy. Diagrams and videos require a connection.';
 if (offlineReady) return 'Routines and activities are saved for offline use. Open each diagram online before relying on it offline.';
 return 'Offline saving becomes available when this app is served over HTTPS or on localhost.';
}
function updateConnection() {
 const status = document.querySelector('#connection');
 if (!status) return;
 status.hidden = navigator.onLine && storageAvailable;
 status.textContent = !storageAvailable ? 'Changes are saved for this visit only. Browser storage is unavailable.' : 'You’re offline. Previously loaded diagrams may be available; videos need a connection.';
 const offlineDetail = document.querySelector('#offline-detail');
 if (offlineDetail) offlineDetail.textContent = offlineDescription();
}
function syncRoute() {
 const [page, id] = route();
 if (page === 'sign' && word(id)) {
  modalOrigin = history.state?.origin || modalOrigin || 'home';
  if (!main.querySelector('h1')) render();
  if (!modal.open || modal.dataset.word !== id) showSign(id);
  return;
 }
 const wasOpen = modal.open;
 if (wasOpen) modal.close();
 clearTimeout(diagramTimer);
 render();
 if (wasOpen) {
  const trigger = main.querySelector('[data-sign="'+returnSign+'"]');
  (trigger || main).focus({preventScroll: true});
 } else {
  window.scrollTo(0, 0);
  main.focus({preventScroll: true});
 }
}
document.addEventListener('click', event => {
 const button = event.target.closest('button');
 if (event.target === modal) {
  const rect = modal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSign();
  return;
 }
 if (!button) return;
 if (button.hasAttribute('data-close')) closeSign();
 else if (button.dataset.sign) openSign(button.dataset.sign);
 else if (button.dataset.save) {
  const id = button.dataset.save;
  const selected = !saved.includes(id);
  saved = selected ? [...saved, id] : saved.filter(item => item !== id);
  const persisted = saveLocal('lsd.saved', saved);
  if (modal.open) {
   render();
   updateSaveButtons();
  } else {
   render();
   (main.querySelector('[data-save="'+id+'"]') || main).focus({preventScroll: true});
  }
  notify((selected ? 'Pinned to your home screen' : 'Sign unpinned')+(persisted ? '' : ' for this visit'));
 } else if (button.hasAttribute('data-zoom')) {
  const viewport = detail.querySelector('.diagram-viewport');
  const enlarged = viewport.classList.toggle('enlarged');
  button.setAttribute('aria-pressed', String(enlarged));
  button.textContent = enlarged ? 'Fit diagram' : 'Enlarge';
 } else if (button.hasAttribute('data-retry')) {
  showSign(modal.dataset.word, true);
 } else if (button.dataset.step !== undefined) {
  snackStep = Number(button.dataset.step);
  render();
  main.querySelector('[data-step="'+snackStep+'"]').focus({preventScroll: true});
 } else if (button.dataset.filter) {
  filter = button.dataset.filter;
  render();
  main.querySelector('[data-filter="'+filter+'"]').focus({preventScroll: true});
 } else if (button.hasAttribute('data-clear')) {
  search = '';
  homeSearch = '';
  filter = 'all';
  render();
  (main.querySelector('#search') || main.querySelector('#home-search')).focus();
 } else if (button.dataset.level) {
  siblingLevel = button.dataset.level;
  render();
  main.querySelector('[data-level="'+siblingLevel+'"]').focus({preventScroll: true});
 } else if (button.hasAttribute('data-practice')) {
  startPractice();
 } else if (button.hasAttribute('data-reveal')) {
  practiceRevealed = true;
  render();
  openSign(practiceIds[practiceIndex]);
 } else if (button.dataset.confidence) {
  familiarity[practiceIds[practiceIndex]] = button.dataset.confidence;
  const persisted = saveLocal('lsd.practice', familiarity);
  practiceIndex += 1;
  practiceRevealed = false;
  render();
  main.focus();
  if (!persisted) notify('Practice choice saved for this visit only.');
 }
});
document.addEventListener('input', event => {
 if (event.target.id === 'search') {
  search = event.target.value;
  const ids = matchingWords(search, filter);
  main.querySelector('#results').innerHTML = resultCards(ids);
  main.querySelector('#result-count').textContent = ids.length+' signs found';
 } else if (event.target.id === 'home-search') {
  homeSearch = event.target.value;
  updateHomeResults();
 }
});
modal.addEventListener('cancel', event => {
 event.preventDefault();
 closeSign();
});
window.addEventListener('hashchange', syncRoute);
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
window.addEventListener('storage', event => {
 if (event.key === 'lsd.saved') {
  saved = validSaved(readStored('lsd.saved', []));
  render();
  if (modal.open) updateSaveButtons();
 }
});
render();
if (route()[0] === 'sign') syncRoute();
if (!window.STANDALONE && 'serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
 navigator.serviceWorker.register('./sw.js', {scope: './'}).then(() => navigator.serviceWorker.ready).then(() => {
  offlineReady = true;
  updateConnection();
 }).catch(() => {
  offlineReady = false;
  updateConnection();
 });
}
