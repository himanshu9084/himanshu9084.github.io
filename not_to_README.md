# himanshu9084.github.io

A static personal website. No build step — just HTML, CSS and JS.

## Structure

```
index.html            Home page (About + latest 2-3 items from each section)
news.html              Full News list
publications.html      Full Publications list
awards.html            Full Awards & Recognition list
service.html           Full Professional Activities list
css/style.css          All styling. Your 3 colors live at the top as CSS
                        variables (--bg, --nc, --bo) — change them once here
                        and the whole site updates.
js/site.js             Loads the CSV files below, parses them, and renders
                        the lists. DATA_SOURCES at the top of this file is
                        the one place that points to each section's data.
data/news.csv
data/publications.csv
data/awards.csv
data/service.csv       Your content. Edit these, nothing else, to update
                        the site.
img/placeholder.svg    Placeholder avatar — replace with your own photo and
                        update the <img src> in index.html.
```

## Updating content (the everyday workflow)

Open the relevant CSV in `data/` (works fine in Excel, Google Sheets, or a
text editor), add/edit a row, save, commit, push. That's it — no HTML or JS
to touch.

- `news.csv` / `awards.csv` / `service.csv` — columns: `date,text`. `text`
  may include `<strong>` or `<em>` for emphasis.
- `publications.csv` — columns: `year,title,venue,pdf_url,code_url`. Leave
  `pdf_url`/`code_url` blank if not applicable.

Rows don't need to be in any particular order — the page sorts by year
automatically, newest first. The home page shows the latest 2-3 entries of
each section; "View all" shows everything.

## Testing locally

Browsers block `fetch()` of local files opened directly (`file://`), so to
preview changes before pushing, serve the folder instead of double-clicking
`index.html`:

```
cd himanshu9084.github.io
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On GitHub Pages itself this isn't an
issue — it's served over `https://`, so it just works.

## Looking ahead: Google Sheets

`DATA_SOURCES` in `js/site.js` is the single switch for where each
section's data comes from. When you're ready to edit from a Google Sheet
instead of a CSV file in the repo:

1. In Sheets: File > Share > Publish to web > choose the tab > CSV.
2. Copy the published URL.
3. Replace that section's entry in `DATA_SOURCES` with the URL.

No other code changes. We'll cover making that sheet properly private
(rather than "anyone with the link") in the next pass.
