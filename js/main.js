/* ==========================================================================
   Linea — scroll film site
   Frames live in assets/frames/f001.webp … f240.webp (24 fps, 10 s).
   See README.md for how to regenerate them from a new video.
   ========================================================================== */
var FRAME_COUNT = 240;
function framePath(n){ return 'assets/frames/f' + String(n + 1).padStart(3, '0') + '.webp'; }  // n is 0-based

var HOUSES = [
  { name:"Sable House", still:"assets/stills/sable.webp", site:"Coastal infill", build:"Poured concrete & timber", pos:"50% center", jump:.085,
    desc:"A poured-concrete courtyard house on a narrow coastal lot, organised around a central garden that draws daylight and sea air into every room." },
  { name:"Ridge House", still:"assets/stills/ridge.webp", site:"Hillside site", build:"In-situ concrete", pos:"35% center", jump:.34,
    desc:"Set into a sloped site above the valley, the house cantilevers toward the view while its service spaces are buried into the hillside behind it." },
  { name:"Fold House", still:"assets/stills/fold.webp", site:"Urban infill", build:"Budget-conscious build", pos:"50% center", jump:.59,
    desc:"A folded roof turns a modest infill lot into a home with volume and light well beyond its footprint, without extending past the neighbouring roof lines." },
  { name:"Grove House", still:"assets/stills/grove.webp", site:"Wooded site", build:"Raised timber-clad box", pos:"80% center", jump:.96,
    desc:"Raised on slender columns above a shallow concrete footing, the house touches its site as lightly as possible, leaving the existing grove of oaks undisturbed." }
];

/* ---------- still images taken from the film ---------- */

var cards = document.getElementById('cards');
HOUSES.forEach(function(h, i){
  var b = document.createElement('button');
  b.className = 'card'; b.type = 'button';
  b.innerHTML = '<div class="card-img"><img alt="' + h.name + '" loading="lazy"></div>' +
    '<h3>' + h.name + '</h3><span>' + h.site + ', ' + h.build.toLowerCase() + '</span><em>View in film</em>';
  var im = b.querySelector('img'); im.src = h.still; im.style.objectPosition = h.pos;
  b.addEventListener('click', function(){ jumpTo(i); });
  cards.appendChild(b);
});

/* ---------- scroll-scrubbed film ---------- */
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var film = document.getElementById('film');
var canvas = document.getElementById('filmCanvas');
var ctx = canvas.getContext('2d', { alpha:false });
var small = window.matchMedia('(max-width:860px)').matches;
var STEP = small ? 2 : 1;                      // phones use every other frame to save memory
var LAST = FRAME_COUNT - 1;                  // timeline in full-rate frames (0..239, 24fps)
var srcIdx = [];
for (var k = 0; k < FRAME_COUNT; k += STEP) srcIdx.push(k);
if (srcIdx[srcIdx.length - 1] !== LAST) srcIdx.push(LAST);
var N = srcIdx.length;

// scroll progress -> film frame: slow over each house, quicker through the transitions
var KEYS = [[0,0],[.17,36],[.25,72],[.43,110],[.50,130],[.68,160],[.76,184],[1,LAST]];
var CUTS = [58, 124, 175];
function progressToFrame(p){
  for (var i = 1; i < KEYS.length; i++){
    if (p <= KEYS[i][0]){
      var a = KEYS[i-1], b = KEYS[i], t = (p - a[0]) / (b[0] - a[0]);
      t = t * t * (3 - 2 * t) * 0.35 + t * 0.65;   // ease each segment a little so the pace changes gently
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return LAST;
}
function houseAt(f){ return f < CUTS[0] ? 0 : f < CUTS[1] ? 1 : f < CUTS[2] ? 2 : 3; }

/* Memory-safe frame loading.
   All frames are downloaded in the background (about 7 MB in total) but stay
   compressed until needed. Only a small window of decoded frames around the
   playhead is kept in memory, and frames that leave the window are released immediately.
   Keeping every decoded frame at once is what made phones and Safari run out of memory. */
var bmps = new Array(N), pending = 0, gen = 0;
var R = small ? 8 : 14, KEEP = R + 4, MAXP = small ? 2 : 3;
var blobs = new Array(N), blobReqs = new Array(N);
function frameBlob(i){
  if (blobs[i]) return Promise.resolve(blobs[i]);
  if (!blobReqs[i]) blobReqs[i] = fetch(framePath(srcIdx[i])).then(function(r){
    if (!r.ok) throw new Error('Frame ' + srcIdx[i] + ' failed to load');
    return r.blob();
  }).then(function(b){ blobs[i] = b; return b; }, function(e){ blobReqs[i] = null; throw e; });
  return blobReqs[i];
}
(function preload(){                               // fetch every frame, 6 at a time, in order
  var next = 0, active = 0;
  function pump(){
    while (active < 6 && next < N){
      active++;
      frameBlob(next++).catch(function(){}).then(function(){ active--; pump(); });
    }
  }
  pump();
})();
var useBitmap = 'createImageBitmap' in window;
function decodeFrame(i){
  return frameBlob(i).then(function(blob){
  if (useBitmap) return createImageBitmap(blob).catch(function(){ useBitmap = false; return decodeFrame(i); });
  return new Promise(function(res, rej){            // fallback for browsers without createImageBitmap
    var url = URL.createObjectURL(blob), im = new Image();
    im.onload = function(){ res(im); setTimeout(function(){ URL.revokeObjectURL(url); }, 0); };
    im.onerror = function(){ URL.revokeObjectURL(url); rej(); };
    im.src = url;
  });
  });
}
function release(j){
  var b = bmps[j];
  if (b && b !== 'loading' && b.close) b.close();
  if (b !== 'loading') bmps[j] = null;
}
function warm(center){
  center = Math.max(0, Math.min(N - 1, Math.round(center)));
  for (var j = 0; j < N; j++) if (Math.abs(j - center) > KEEP) release(j);
  var myGen = gen;
  for (var d = 0; d <= R && pending < MAXP; d++){
    var pair = d === 0 ? [center] : [center + d, center - d];
    for (var q = 0; q < pair.length && pending < MAXP; q++){
      var i = pair[q];
      if (i < 0 || i >= N || bmps[i]) continue;
      bmps[i] = 'loading'; pending++;
      (function(i){
        decodeFrame(i).then(function(b){
          if (myGen !== gen || Math.abs(i - pos) > KEEP){ if (b.close) b.close(); bmps[i] = null; }
          else { bmps[i] = b; if (Math.abs(i - pos) < 2) draw(true); }
        }, function(){ bmps[i] = null; })
        .then(function(){ pending--; if (!document.hidden) warm(pos); });
      })(i);
    }
  }
}
function ready(i){ var b = bmps[i]; return b && b !== 'loading' ? b : null; }
function nearestReady(i){                           // never show a blank frame while one is decoding
  for (var d = 0; d <= KEEP; d++){
    var a = ready(i - d); if (a) return a;
    var b = ready(i + d); if (b) return b;
  }
  return null;
}
document.addEventListener('visibilitychange', function(){
  if (document.hidden){ gen++; for (var j = 0; j < N; j++) release(j); }   // free memory in the background
  else { warm(pos); draw(true); }
});
window.addEventListener('pagehide', function(){ gen++; for (var j = 0; j < N; j++) release(j); });

function sizeCanvas(){
  var r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
  var w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (w !== canvas.width || h !== canvas.height){ canvas.width = w; canvas.height = h; }
  ctx.imageSmoothingQuality = 'high';
  draw(true);
}
function cover(im, alpha){
  var cw = canvas.width, ch = canvas.height, iw = im.width || im.naturalWidth, ih = im.height || im.naturalHeight;
  var s = Math.max(cw / iw, ch / ih), w = iw * s, h = ih * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
}
var pos = 0, drawnKey = -1;                    // pos = position in the loaded frame list (fractional)
function draw(force){
  var key = Math.round(pos * 32);
  if (!force && key === drawnKey) return;
  var i0 = Math.floor(pos), i1 = Math.min(i0 + 1, N - 1), frac = pos - i0;
  var a = ready(i0), exact = !!a;
  if (!a) a = nearestReady(i0);
  if (!a) return;
  try {
    cover(a, 1);
    var b = exact && frac > 0.03 ? ready(i1) : null;
    if (b) cover(b, frac);                       // blend neighbouring frames for in-between positions
  } catch (err) { /* a frame was released mid-draw; the next tick redraws */ }
  ctx.globalAlpha = 1;
  if (exact) drawnKey = key;
}

var cur = 0, target = 0, running = false, lastT = 0, shown = -1;
var strip = document.getElementById('strip');
var el = {
  num:document.getElementById('countNum'), bar:document.getElementById('countBar'),
  name:document.getElementById('houseName'), desc:document.getElementById('houseDesc'),
  site:document.getElementById('houseSite'), build:document.getElementById('houseBuild')
};
function setHouse(i){
  if (i === shown) return;
  var first = shown === -1; shown = i;
  var h = HOUSES[i];
  el.num.textContent = '0' + (i + 1);
  function apply(){ el.name.textContent = h.name; el.desc.textContent = h.desc; el.site.textContent = h.site; el.build.textContent = h.build; strip.classList.remove('swap'); }
  if (first || reduce){ apply(); return; }
  strip.classList.add('swap');
  clearTimeout(setHouse.t); setHouse.t = setTimeout(apply, 220);
}

function tick(now){
  var dt = lastT ? Math.min(now - lastT, 64) : 16; lastT = now;
  var d = target - cur;
  if (reduce || Math.abs(d) < 0.02) cur = target;
  else cur += d * (1 - Math.exp(-dt / 55));    // frame-rate independent easing toward the scroll position
  pos = Math.min(cur / STEP, N - 1);
  draw(false);
  warm(pos);
  setHouse(houseAt(cur));
  el.bar.style.transform = 'scaleX(' + (cur / LAST).toFixed(4) + ')';
  if (cur !== target) requestAnimationFrame(tick); else { running = false; lastT = 0; }
}

function filmProgress(y){
  var span = film.offsetHeight - window.innerHeight;
  return Math.max(0, Math.min(1, (y - film.offsetTop) / span));
}
var hint = document.getElementById('scrollHint'), header = document.getElementById('siteHeader');
function onScroll(){
  var y = lenis ? lenis.scroll : window.scrollY;
  var p = filmProgress(y);
  target = progressToFrame(p);
  if (!running){ running = true; requestAnimationFrame(tick); }
  hint.style.opacity = p > 0.02 ? 0 : .8;
  header.classList.toggle('solid', film.offsetTop + film.offsetHeight - y < 90);
}

/* smooth, inertial page scrolling for mouse wheels and trackpads (touch stays native) */
var lenis = null;
if (!reduce && window.Lenis){
  lenis = new Lenis({ lerp:0.09, wheelMultiplier:0.9, smoothWheel:true });
  lenis.on('scroll', onScroll);
  (function raf(t){ lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
}
function scrollToY(y){
  if (lenis) lenis.scrollTo(y, { force:true, duration:1.6, easing:function(t){ return 1 - Math.pow(1 - t, 3); } });
  else window.scrollTo({ top:y, behavior: reduce ? 'auto' : 'smooth' });
}
document.querySelectorAll('a[href^="#"]').forEach(function(a){
  a.addEventListener('click', function(e){
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var t = document.querySelector(id); if (!t) return;
    e.preventDefault();
    closeMenu(false);
    var y = id === '#film' ? 0 : t.getBoundingClientRect().top + (lenis ? lenis.scroll : window.scrollY) - 84;
    scrollToY(y);
  });
});
function jumpTo(i){
  var span = film.offsetHeight - window.innerHeight;
  scrollToY(film.offsetTop + span * HOUSES[i].jump);
}

window.addEventListener('scroll', onScroll, { passive:true });
var rzT; window.addEventListener('resize', function(){ clearTimeout(rzT); rzT = setTimeout(function(){ sizeCanvas(); onScroll(); }, 120); });
sizeCanvas(); warm(0);
(function waitFirst(){ if (nearestReady(Math.round(pos))){ document.getElementById('filmLoading').style.display = 'none'; draw(true); } else setTimeout(waitFirst, 50); })();
setHouse(0); onScroll();

/* ---------- process stage ---------- */
(function initProcess(){
  var root = document.getElementById('process');
  if (!root) return;

  var STEPS = [
    {
      num:'01', title:'Brief',
      body:'We start by understanding the site, the budget, and how you want to live, before a single line is drawn.',
      src:'assets/process/process-brief.webp',
      alt:'Site survey, notes and material samples from an early project briefing'
    },
    {
      num:'02', title:'Concept',
      body:'Early sketches and massing studies test a handful of directions against the site\'s light, wind and views.',
      src:'assets/process/process-concept.webp',
      alt:'Graphite massing sketches on trace paper over a site plan'
    },
    {
      num:'03', title:'Documentation',
      body:'The chosen concept becomes a full construction set, coordinated with the structural and services engineers.',
      src:'assets/process/process-documentation.webp',
      alt:'Printed floor plans and section drawings on a drafting table'
    },
    {
      num:'04', title:'Approval',
      body:'We manage the planning and building consent process, including any variations or conditions along the way.',
      src:'assets/process/process-approval.webp',
      alt:'Planning documents and site plan folder prepared for consent'
    },
    {
      num:'05', title:'Construction',
      body:'We stay involved through the build, working alongside the builder to keep the design intact as it is constructed.',
      src:'assets/process/process-construction.webp',
      alt:'Board-formed concrete formwork and timber on an active build'
    }
  ];

  console.log('[Linea][process] using generated process stills');

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-process-tabs] [data-step]'));
  var img = root.querySelector('[data-process-img]');
  var panel = root.querySelector('[data-process-panel]');
  var titleEl = root.querySelector('[data-process-title]');
  var bodyEl = root.querySelector('[data-process-body]');
  var active = 0;
  var pending = null;
  var timer = null;

  if (!tabs.length || !img || !panel || !titleEl || !bodyEl){
    console.warn('[Linea][process] missing markup, skip init', {
      tabs:tabs.length, img:!!img, panel:!!panel, title:!!titleEl, body:!!bodyEl
    });
    return;
  }

  console.log('[Linea][process] init', STEPS.length + ' steps');

  function apply(i){
    var step = STEPS[i];
    active = i;
    tabs.forEach(function(tab, ti){
      var on = ti === i;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    panel.setAttribute('aria-labelledby', 'process-tab-' + i);
    img.src = step.src;
    img.alt = step.alt;
  }

  function setStep(i, opts){
    opts = opts || {};
    if (i < 0 || i >= STEPS.length) return;
    if (i === active && !opts.force) return;

    // queue rapid clicks instead of dropping them while a fade is running
    if (timer && !opts.force){
      pending = i;
      console.log('[Linea][process] queued step', STEPS[i].num);
      return;
    }

    var step = STEPS[i];
    var instant = reduce || opts.instant;
    console.log('[Linea][process] step →', step.num, step.title);

    if (instant){
      apply(i);
      img.classList.remove('is-swap');
      panel.classList.remove('is-swap');
      return;
    }

    img.classList.add('is-swap');
    panel.classList.add('is-swap');

    timer = window.setTimeout(function(){
      timer = null;
      apply(i);
      img.classList.remove('is-swap');
      panel.classList.remove('is-swap');
      if (pending !== null && pending !== active){
        var next = pending;
        pending = null;
        setStep(next);
      } else {
        pending = null;
      }
    }, 180);
  }

  tabs.forEach(function(tab){
    tab.addEventListener('click', function(e){
      e.preventDefault();
      var i = parseInt(tab.getAttribute('data-step'), 10);
      console.log('[Linea][process] click', i);
      setStep(i);
    });
    tab.addEventListener('keydown', function(e){
      var next = active;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (active + 1) % STEPS.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (active - 1 + STEPS.length) % STEPS.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = STEPS.length - 1;
      else return;
      e.preventDefault();
      setStep(next);
      tabs[next].focus();
    });
  });

  if ('IntersectionObserver' in window){
    var seen = false;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (!entry.isIntersecting || seen) return;
        seen = true;
        console.log('[Linea][process] in view');
        io.disconnect();
      });
    }, { threshold:0.2 });
    io.observe(root);
  }

  setStep(0, { force:true, instant:true });
})();

/* ---------- mobile menu ---------- */
var navToggle = document.getElementById('navToggle'), menu = document.getElementById('mobileMenu'), closeBtn = document.getElementById('mobileMenuClose');
function openMenu(){ if (lenis) lenis.stop(); menu.classList.add('open'); document.body.classList.add('menu-open'); navToggle.setAttribute('aria-expanded','true'); setTimeout(function(){ closeBtn.focus(); }, 60); }
function closeMenu(back){ if (!menu.classList.contains('open')) return; menu.classList.remove('open'); if (lenis) lenis.start(); document.body.classList.remove('menu-open'); navToggle.setAttribute('aria-expanded','false'); if (back) navToggle.focus(); }
navToggle.addEventListener('click', openMenu);
closeBtn.addEventListener('click', function(){ closeMenu(true); });
menu.querySelectorAll('nav a').forEach(function(a){ a.addEventListener('click', function(){ closeMenu(false); }); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenu(true); });
window.matchMedia('(min-width:861px)').addEventListener('change', function(m){ if (m.matches) closeMenu(false); });
