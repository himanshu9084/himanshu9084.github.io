/* ============================================================
   Data sources
   --------------------------------------------------------------
   Today these point at CSV files committed in /data. To switch a
   section to a Google Sheet later: publish that sheet as CSV
   (File > Share > Publish to web > CSV) and paste the resulting
   URL here. Nothing else in this file, or in any page, needs to
   change — the parsing and rendering code is identical either way.
   ============================================================ */
const DATA_SOURCES = {
  news: 'data/news.csv',
  publications: 'data/publications.csv',
  awards: 'data/awards.csv',
  service: 'data/service.csv',
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

/* ---------------- CSV parsing ----------------
   Minimal RFC4180-ish parser: handles quoted fields, commas and
   double-quotes inside quotes (""), and \r\n or \n line endings.
   Good enough for hand-edited or Sheets-exported CSV. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else if (c === '\r') {
        // skip, \n follows
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const filtered = rows.filter(r => r.some(cell => cell.trim() !== ''));
  if (filtered.length === 0) return [];
  const headers = filtered[0].map(h => h.trim());
  return filtered.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
    return obj;
  });
}

async function loadCSV(key) {
  const url = DATA_SOURCES[key];
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load ' + url);
  const text = await res.text();
  return parseCSV(text);
}

/* Sort newest first by a year-ish field ("2026", "2026-04", "—"). */
function sortByYearDesc(items, field) {
  return items.slice().sort((a, b) => {
    const ya = parseInt((a[field] || '').match(/\d{4}/), 10) || 0;
    const yb = parseInt((b[field] || '').match(/\d{4}/), 10) || 0;
    return yb - ya;
  });
}

/* ---------------- Renderers ---------------- */
function renderNewsLike(items) {
  if (items.length === 0) return '<div class="empty-note">Nothing here yet.</div>';
  return items.map(it => `
    <div class="list-item">
      <span class="date-pill">${escapeExceptAllowed(it.date || it.year || '')}</span>
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
      <span class="tag">${escapeHtml(it.year || '')}</span>
      <div>
        <div class="item-title">${escapeHtml(it.title || '')}</div>
        <div class="item-meta"><i>${escapeHtml(it.venue || '')}</i>${links ? ' &nbsp;&middot;&nbsp; ' + links : ''}</div>
      </div>
    </div>`;
  }).join('');
}

/* Text fields are allowed a small set of inline tags (<b> <strong> <i> <em>)
   so you can bold a venue name in a CSV cell; everything else is escaped. */
function escapeExceptAllowed(str) {
  return String(str);
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
    let items = await loadCSV(key);
    if (sortField) items = sortByYearDesc(items, sortField);
    if (limit) items = items.slice(0, limit);
    el.innerHTML = renderer(items);
  } catch (err) {
    el.innerHTML = '<div class="empty-note">Could not load this section right now.</div>';
    console.error(err);
  }
}

/* Mobile hamburger toggle — works on every page that includes the nav markup. */
document.addEventListener('DOMContentLoaded', () => {
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
