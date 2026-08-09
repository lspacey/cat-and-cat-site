/* ==========================================================================
   app.js — Tiles Fun | Photo mosaic viewer with CSS Flexbox wrap layout + lightbox
   Pure vanilla JS — no frameworks, no build tools, no external CDN dependencies.
   ========================================================================== */

const APP_JS_VERSION = 'v16-flexbox-wrap';
console.log(
    `%c[Tiles Fun] app.js VERSION: ${APP_JS_VERSION}`,
    'color: #0f0; background: #000; font-size: 14px; font-weight: bold; padding: 4px;'
);

// ---------------------------------------------------------------------------
// Constants — tweak these at the top
// ---------------------------------------------------------------------------
const SWIPE_THRESHOLD      = 50;        // min px delta for a swipe to count

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let allEntries  = [];         // initial hourly-shuffled pool (flat entry array)
let layout      = [];         // lightbox navigation order = flat entry array
let currentIdx  = -1;         // index of the image currently open in the lightbox
let touchStartX = 0;          // for swipe detection
let preloaded   = new Set();  // URLs already preloaded (lightbox)

// ---------------------------------------------------------------------------
// DOM references (cached after DOMContentLoaded)
// ---------------------------------------------------------------------------
let $mosaic, $lightbox, $lbImg, $lbCount, $lbSpinner, $errorBanner;

// ---------------------------------------------------------------------------
// Seedable PRNG — Mulberry32
// ---------------------------------------------------------------------------
function mulberry32(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// Seeded Fisher-Yates shuffle (in-place, returns the same array reference)
// ---------------------------------------------------------------------------
function seededShuffle(seed, arr) {
    const rng = mulberry32(seed);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------------------------------------------------------------------------
// Hourly seed — YYYYMMDDHH as integer
// ---------------------------------------------------------------------------
function hourlySeed() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm   = pad(d.getMonth() + 1);
    const dd   = pad(d.getDate());
    const hh   = pad(d.getHours());
    return parseInt(`${yyyy}${mm}${dd}${hh}`, 10);
}

// ---------------------------------------------------------------------------
// Normalise images.json entries into a flat array
// ---------------------------------------------------------------------------
function normaliseEntries(raw) {
    const entries = [];
    for (const [filename, info] of Object.entries(raw)) {
        entries.push({
            filename,
            thumb: `thumbs/${info.subdir}/${filename}`,
            full:  `pics/${info.subdir}/${filename}`,
        });
    }
    return entries;
}

// ---------------------------------------------------------------------------
// Show an on-page error banner
// ---------------------------------------------------------------------------
function showError(msg) {
    if ($errorBanner) {
        $errorBanner.textContent = msg;
        $errorBanner.style.display = 'block';
    }
}

// ---------------------------------------------------------------------------
// Build layout and re-render
// ---------------------------------------------------------------------------
function buildLayoutAndRender() {
    layout = allEntries;   // lightbox navigation order = shuffle order
    renderMosaic(allEntries);
}

// ---------------------------------------------------------------------------
// Render mosaic tiles into the DOM using CSS Flexbox wrap
// ---------------------------------------------------------------------------
function renderMosaic(entries) {
    if (!$mosaic) return;
    $mosaic.innerHTML = '';
    entries.forEach((entry, i) => {
        const img = document.createElement('img');
        img.src = entry.thumb;
        img.alt = entry.filename;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openLightbox(i));
        $mosaic.appendChild(img);
    });
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function openLightbox(index) {
    if (index < 0 || index >= layout.length) return;
    currentIdx = index;
    $lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateLightboxImage();
}

function closeLightbox() {
    $lightbox.style.display = 'none';
    document.body.style.overflow = '';
    currentIdx = -1;
    if ($lbSpinner) $lbSpinner.style.display = 'none';
}

function updateLightboxImage() {
    const entry = layout[currentIdx];
    if (!entry) return;

    // Show spinner, hide image until loaded
    if ($lbSpinner) $lbSpinner.style.display = 'block';
    $lbImg.style.opacity = '0';

    $lbImg.onload = () => {
        if ($lbSpinner) $lbSpinner.style.display = 'none';
        $lbImg.style.opacity = '1';
    };
    $lbImg.onerror = () => {
        if ($lbSpinner) $lbSpinner.style.display = 'none';
    };

    $lbImg.src = entry.full;
    $lbImg.alt = entry.filename;
    $lbCount.textContent = `${currentIdx + 1} / ${layout.length}`;
    preloadImage(currentIdx - 1);
    preloadImage(currentIdx + 1);
}

function showNext() {
    if (layout.length === 0) return;
    currentIdx = (currentIdx + 1) % layout.length;
    updateLightboxImage();
}

function showPrevious() {
    if (layout.length === 0) return;
    currentIdx = (currentIdx - 1 + layout.length) % layout.length;
    updateLightboxImage();
}

function preloadImage(idx) {
    if (idx < 0 || idx >= layout.length) return;
    const url = layout[idx].full;
    if (preloaded.has(url)) return;
    preloaded.add(url);
    const link = document.createElement('link');
    link.rel  = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
}

function downloadCurrent() {
    const entry = layout[currentIdx];
    if (!entry) return;
    const a = document.createElement('a');
    a.href     = entry.full;
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ---------------------------------------------------------------------------
// Swipe handlers (touch)
// ---------------------------------------------------------------------------
function setupSwipeHandlers() {
    if (!$lightbox) return;
    $lightbox.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    }, { passive: true });
    $lightbox.addEventListener('touchend', (e) => {
        if (currentIdx < 0) return;
        const endX = e.changedTouches[0]?.clientX || touchStartX;
        const dx = endX - touchStartX;
        if (Math.abs(dx) >= SWIPE_THRESHOLD) {
            dx < 0 ? showNext() : showPrevious();
        }
    });
}

// ---------------------------------------------------------------------------
// Keyboard handlers
// ---------------------------------------------------------------------------
function setupKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
        if (currentIdx < 0) return;
        switch (e.key) {
            case 'Escape':     e.preventDefault(); closeLightbox();  break;
            case 'ArrowRight': e.preventDefault(); showNext();       break;
            case 'ArrowLeft':  e.preventDefault(); showPrevious();   break;
        }
    });
}

// ---------------------------------------------------------------------------
// Fetch images.json, normalise, shuffle, layout, render
// ---------------------------------------------------------------------------
async function loadImages() {
    try {
        const resp = await fetch('./images.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        allEntries = normaliseEntries(raw);
        if (allEntries.length === 0) {
            showError('images.json contains no entries.');
            return;
        }
        document.title = `Tiles Fun — Photo Mosaic - ${allEntries.length}`;
        seededShuffle(hourlySeed(), allEntries);
        buildLayoutAndRender();
    } catch (err) {
        console.error(err);
        showError(
            'Could not load images.json — please serve this page via a ' +
            'local HTTP server instead of opening the file directly ' +
            '(use the \'Run webserver for testing\' option in the Python script).'
        );
    }
}

// ---------------------------------------------------------------------------
// Bootstrap — runs after DOM is ready
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    $mosaic      = document.getElementById('mosaic');
    $lightbox    = document.getElementById('lightbox');
    $lbImg       = document.getElementById('lb-img');
    $lbCount     = document.getElementById('lb-count');
    $lbSpinner   = document.getElementById('lb-spinner');
    $errorBanner = document.getElementById('error-banner');

    document.getElementById('lb-close')   ?.addEventListener('click', closeLightbox);
    document.getElementById('lb-prev')    ?.addEventListener('click', (e) => { e.stopPropagation(); showPrevious(); });
    document.getElementById('lb-next')    ?.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });
    document.getElementById('lb-download')?.addEventListener('click', (e) => { e.stopPropagation(); downloadCurrent(); });

    $lightbox?.addEventListener('click', (e) => {
        if (e.target !== $lbImg) closeLightbox();
    });
    $lbImg?.addEventListener('click', (e) => {
        e.stopPropagation();
        showNext();
    });

    setupKeyboardHandlers();
    setupSwipeHandlers();

    loadImages();
});

