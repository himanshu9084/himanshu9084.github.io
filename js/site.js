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
const PROFILE_PHOTO_URL = 'img/placeholder.svg';

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

/* ---------------- Renderers ---------------- */
function renderNewsLike(items) {
  if (items.length === 0) return '<div class="empty-note">Nothing here yet.</div>';
  return items.map(it => `
    <div class="list-item">
      <span class="date-pill">${it.date ?? it.year ?? ''}</span>
      <span class="item-text">${it.text || ''}</span>
    </div>`).join('');
}

function renderPublications(items) {
  if (items.length === 0) return '<div class="empty-note">Nothing here yet.</div>';
  return items.map(it => {
    const links = [
      it.pdf_url ? `<a href="${escapeAttr(it.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : '',
      it.code_url ? `<a href="${escapeAttr(it.code_url)}" target="_blank" rel="noopener">Code</a>` : '',
    ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ');
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

document.addEventListener('DOMContentLoaded', () => {
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
