/* ============================================================
   Data source — ONE workbook, one sheet per section
   --------------------------------------------------------------
   All content lives in data/data.xlsx, as four sheets/tabs:
     News | Publications | Awards | Service
   This mirrors exactly how a Google Sheet works (one file, several
   tabs), so moving to Sheets later is a straight swap of WORKBOOK_URL
   for the sheet's published link — the sheet names below stay the same.
   ============================================================ */
const WORKBOOK_URL = 'data/data.xlsx';
const SHEETS = {
  news: 'News',
  publications: 'Publications',
  awards: 'Awards',
  service: 'Service',
};

/* ============================================================
   Profile photo
   --------------------------------------------------------------
   Two ways to set it — pick one, it's a single line either way:

   Option A — static upload: put the image file in img/ (e.g.
     img/photo.jpg) and point this at it:
       const PROFILE_PHOTO_URL = 'img/photo.jpg';

   Option B — URL: point this straight at any direct image link
     (GitHub raw URL, a Google Drive "direct link", etc.) and skip
     keeping the file in the repo at all:
       const PROFILE_PHOTO_URL = 'https://example.com/photo.jpg';

   Either way, this is the only line you change.
   ============================================================ */
const PROFILE_PHOTO_URL = 'https://scai.iitd.ac.in/public/uploads/aiz258466_himanshukumar.jpg';

/* ---------------- Workbook loading (via SheetJS, loaded in <head>) ---------------- */
let _workbookPromise = null;
function loadWorkbook() {
  if (!_workbookPromise) {
    _workbookPromise = fetch(WORKBOOK_URL, { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('Could not load ' + WORKBOOK_URL); return res.arrayBuffer(); })
      .then(buf => XLSX.read(buf, { type: 'array' }));
  }
  return _workbookPromise;
}

async function loadSheet(key) {
  const wb = await loadWorkbook();
  const sheetName = SHEETS[key];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('No sheet named "' + sheetName + '" in ' + WORKBOOK_URL);
  // defval keeps missing cells as '' instead of being dropped from the row
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

/* Sort newest first by a year-ish field ("2026", "2026-04", "—"). */
function sortByYearDesc(items, field) {
  return items.slice().sort((a, b) => {
    const ya = parseInt(String(a[field] || '').match(/\d{4}/), 10) || 0;
    const yb = parseInt(String(b[field] || '').match(/\d{4}/), 10) || 0;
    return yb - ya;
  });
}

/* ---------------- Link-column auto-detection ----------------
   Shared by every section. A sheet's "fixed" columns are styled
   specially (date/text, or year/title/venue); every OTHER column
   whose header ends in "url" is picked up automatically and shown
   as a labelled link, in the same left-to-right order as the
   columns in the sheet. Add a column in data.xlsx, name it anything
   ending in "_url" (pdf_url, code_url, arxiv_url, poster_url,
   slides_url, video_url, doi_url, event_url, certificate_url, ...),
   fill it in for a row — it shows up with no code change. Leave a
   cell blank and nothing renders for that row. */
const LINK_LABEL_OVERRIDES = {
  pdf: 'PDF', arxiv: 'arXiv', doi: 'DOI', bibtex: 'BibTeX', api: 'API',
  isbn: 'ISBN', slides: 'Slides', poster: 'Poster', video: 'Video',
  demo: 'Demo', code: 'Code', dataset: 'Dataset', talk: 'Talk',
};
function labelForLinkColumn(column) {
  const base = column.replace(/_?url$/i, '').replace(/_/g, ' ').trim();
  if (!base) return 'Link';
  const override = LINK_LABEL_OVERRIDES[base.toLowerCase()];
  if (override) return override;
  return base.replace(/\b\w/g, c => c.toUpperCase());
}
function extractLinkChips(it, fixedFields) {
  const chips = [];
  Object.keys(it).forEach(column => {
    const lower = column.trim().toLowerCase();
    if (fixedFields.has(lower)) return;
    if (!lower.endsWith('url')) return;
    const value = it[column];
    if (!value) return;
    chips.push(`<a href="${escapeAttr(value)}" target="_blank" rel="noopener">${escapeHtml(labelForLinkColumn(column))}</a>`);
  });
  return chips;
}

/* ---------------- Renderers ---------------- */

/* News / Awards / Service: date + text are the fixed fields. Any
   "*_url" column (e.g. a news item linking to a press article, an
   award linking to a certificate, a service entry linking to a CFP)
   is auto-detected the same way as in Publications — just give it a
   custom name ending in "_url". */
const NEWSLIKE_FIXED_FIELDS = new Set(['date', 'year', 'text']);
function renderNewsLike(items) {
  if (items.length === 0) return '<div class="empty-note">Nothing here yet.</div>';
  return items.map(it => {
    const chips = extractLinkChips(it, NEWSLIKE_FIXED_FIELDS);
    const links = chips.length ? `<div class="item-meta">${chips.join(' &nbsp;&middot;&nbsp; ')}</div>` : '';
    return `
    <div class="list-item">
      <span class="date-pill">${it.date ?? it.year ?? ''}</span>
      <div>
        <div class="item-text">${it.text || ''}</div>
        ${links}
      </div>
    </div>`;
  }).join('');
}

/* Publications: year/title/venue are the fixed, styled fields. */
const PUBLICATION_FIXED_FIELDS = new Set(['year', 'title', 'venue']);
function renderPublications(items) {
  if (items.length === 0) return '<div class="empty-note">Nothing here yet.</div>';
  return items.map(it => {
    const chips = extractLinkChips(it, PUBLICATION_FIXED_FIELDS);
    const links = chips.join(' &nbsp;&middot;&nbsp; ');
    return `
    <div class="list-item">
      <span class="tag">${escapeHtml(it.year ?? '')}</span>
      <div>
        <div class="item-title">${escapeHtml(it.title || '')}</div>
        <div class="item-meta"><i>${escapeHtml(it.venue || '')}</i>${links ? ' &nbsp;&middot;&nbsp; ' + links : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/* ---------------- Page wiring ---------------- */
async function renderSection(key, containerId, { limit, renderer, sortField } = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  try {
    let items = await loadSheet(key);
    if (sortField) items = sortByYearDesc(items, sortField);
    if (limit) items = items.slice(0, limit);
    el.innerHTML = renderer(items);
  } catch (err) {
    el.innerHTML = '<div class="empty-note">Could not load this section right now.</div>';
    console.error(err);
  }
}

/* ---------------- Theme toggle (light / dark) ----------------
   The actual theme is applied by a tiny inline script in each page's
   <head> (it has to run before CSS paints, to avoid a flash of the
   wrong theme — that part can't live here in the external file, which
   loads too late for that). This just wires up the button's click and
   keeps localStorage updated; both places agree on the same key/values
   ('theme' => 'dark' | 'light'). */
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable — theme just won't persist */ }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

  // Mobile hamburger toggle — works on every page that includes the nav markup.
  const btn = document.querySelector('.hamburger');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Profile photo (index.html only — other pages have no #avatar element)
  const avatar = document.getElementById('avatar');
  if (avatar && PROFILE_PHOTO_URL) avatar.src = PROFILE_PHOTO_URL;

  // Email links: built from data-user/data-domain at runtime so the
  // address never sits as plain text (or "mailto:...@...") in the HTML
  // that scrapers read. Not bulletproof against bots that run JS, but it
  // stops the simple "grep the page for an @ sign" crawlers most spam
  // harvesting relies on.
  document.querySelectorAll('[data-user][data-domain]').forEach(el => {
    el.setAttribute('href', 'mailto:' + el.dataset.user + '@' + el.dataset.domain);
  });
});
