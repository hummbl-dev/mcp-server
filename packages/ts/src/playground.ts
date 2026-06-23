/**
 * HUMMBL Browser Playground
 *
 * A single-file HTML page served at GET /playground. Vanilla JS,
 * no build step, no framework. Talks to the existing REST API.
 */

export const PLAYGROUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HUMMBL Base120 Playground</title>
<style>
  :root { --bg: #0f172a; --surface: #1e293b; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; --accent2: #818cf8; --green: #4ade80; --code-bg: #0d1117; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
  .container { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
  h1 { font-size: 1.5rem; color: var(--accent); }
  h2 { font-size: 1.15rem; color: var(--accent2); margin-bottom: 0.75rem; }
  .auth { display: flex; gap: 0.5rem; align-items: center; }
  .auth input { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; width: 280px; }
  .auth .status { font-size: 0.8rem; color: var(--muted); }
  section { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; margin-bottom: 1.5rem; }
  .search-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .search-row input, .search-row textarea { flex: 1; background: var(--code-bg); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.9rem; resize: vertical; }
  .search-row textarea { min-height: 60px; }
  button { background: var(--accent); color: var(--bg); border: none; padding: 0.5rem 1.25rem; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.9rem; white-space: nowrap; }
  button:hover { opacity: 0.85; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
  .card { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; }
  .card h3 { font-size: 0.95rem; color: var(--accent); margin-bottom: 0.25rem; }
  .card .code { font-family: monospace; font-size: 0.8rem; color: var(--green); }
  .card p { font-size: 0.82rem; color: var(--muted); margin-top: 0.25rem; }
  .card .score { font-size: 0.75rem; color: var(--accent2); margin-top: 0.25rem; }
  .trans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
  .trans-card { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; cursor: pointer; transition: border-color 0.15s; }
  .trans-card:hover { border-color: var(--accent); }
  .trans-card h3 { font-size: 0.95rem; color: var(--accent2); }
  .trans-card p { font-size: 0.8rem; color: var(--muted); }
  .empty { color: var(--muted); font-size: 0.85rem; padding: 1rem 0; }
  .loading { color: var(--muted); font-size: 0.85rem; }
  #results, #rec-results, #trans-detail { margin-top: 1rem; }
  footer { text-align: center; color: var(--muted); font-size: 0.8rem; margin-top: 2rem; padding-bottom: 2rem; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>HUMMBL Base120 Playground</h1>
    <div class="auth">
      <input type="password" id="api-key" placeholder="hummbl_your_api_key" />
      <span class="status" id="auth-status">Enter API key</span>
    </div>
  </header>

  <section>
    <h2>Models</h2>
    <div class="search-row">
      <input type="text" id="model-query" placeholder="Search models (e.g. 'decision', 'feedback')..." />
      <button id="model-search-btn">Search</button>
    </div>
    <div id="results" class="grid"></div>
  </section>

  <section>
    <h2>Recommendations</h2>
    <div class="search-row">
      <textarea id="problem-input" placeholder="Describe your problem (min 10 chars)..."></textarea>
      <button id="recommend-btn">Recommend</button>
    </div>
    <div id="rec-results" class="grid"></div>
  </section>

  <section>
    <h2>Transformations</h2>
    <div id="trans-grid" class="trans-grid"></div>
    <div id="trans-detail"></div>
  </section>

  <footer>
    <a href="/openapi.json" target="_blank">OpenAPI Spec</a> &middot;
    <a href="/health" target="_blank">Health</a> &middot;
    <a href="https://github.com/hummbl-dev/mcp-server" target="_blank">GitHub</a>
  </footer>
</div>

<script>
(function() {
  const $ = (s) => document.querySelector(s);
  const apiKey = () => $('#api-key').value.trim();
  const headers = () => ({ 'Authorization': 'Bearer ' + apiKey(), 'Content-Type': 'application/json' });

  // Persist API key in localStorage
  const stored = localStorage.getItem('hummbl_api_key');
  if (stored) { $('#api-key').value = stored; $('#auth-status').textContent = 'Key loaded'; }
  $('#api-key').addEventListener('input', () => {
    localStorage.setItem('hummbl_api_key', apiKey());
    $('#auth-status').textContent = apiKey() ? 'Key set' : 'Enter API key';
  });

  async function apiFetch(path, opts = {}) {
    if (!apiKey()) { alert('Please enter your API key first.'); return null; }
    try {
      const res = await fetch(path, { headers: headers(), ...opts });
      if (!res.ok) {
        const err = await res.text();
        alert('API error ' + res.status + ': ' + err);
        return null;
      }
      return await res.json();
    } catch(e) { alert('Network error: ' + e.message); return null; }
  }

  function modelCard(m) {
    return '<div class="card"><span class="code">' + m.code + '</span>'
      + '<h3>' + esc(m.name) + '</h3>'
      + '<p>' + esc(m.definition) + '</p></div>';
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // Model search
  $('#model-search-btn').addEventListener('click', async () => {
    const q = $('#model-query').value.trim();
    if (q.length < 2) { alert('Query must be at least 2 characters.'); return; }
    $('#results').innerHTML = '<div class="loading">Searching...</div>';
    const data = await apiFetch('/v1/search?q=' + encodeURIComponent(q));
    if (!data) { $('#results').innerHTML = ''; return; }
    if (data.results.length === 0) {
      $('#results').innerHTML = '<div class="empty">No models found.</div>';
    } else {
      $('#results').innerHTML = data.results.map(modelCard).join('');
    }
  });
  $('#model-query').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#model-search-btn').click(); });

  // Recommendations
  $('#recommend-btn').addEventListener('click', async () => {
    const problem = $('#problem-input').value.trim();
    if (problem.length < 10) { alert('Problem must be at least 10 characters.'); return; }
    $('#rec-results').innerHTML = '<div class="loading">Getting recommendations...</div>';
    const data = await apiFetch('/v1/recommend', { method: 'POST', body: JSON.stringify({ problem }) });
    if (!data) { $('#rec-results').innerHTML = ''; return; }
    if (data.recommendations.length === 0) {
      $('#rec-results').innerHTML = '<div class="empty">No recommendations found.</div>';
    } else {
      $('#rec-results').innerHTML = data.recommendations.map(function(rec) {
        const models = rec.topModels.map(function(m) {
          return '<div class="card"><span class="code">' + m.code + '</span>'
            + '<h3>' + esc(m.name) + '</h3>'
            + '<p>' + esc(m.definition) + '</p></div>';
        }).join('');
        const score = rec.score !== undefined ? '<span class="score">Score: ' + rec.score + '</span>' : '';
        return '<div class="card" style="grid-column: 1 / -1"><h3>' + esc(rec.pattern) + '</h3>'
          + score
          + '<div class="grid" style="margin-top:0.5rem">' + models + '</div></div>';
      }).join('');
    }
  });

  // Transformations
  const TRANS = ['P','IN','CO','DE','RE','SY'];
  const NAMES = { P:'Perspective', IN:'Inversion', CO:'Composition', DE:'Decomposition', RE:'Recursion', SY:'Meta-Systems' };
  $('#trans-grid').innerHTML = TRANS.map(function(k) {
    return '<div class="trans-card" data-key="' + k + '"><h3>' + k + '</h3><p>' + NAMES[k] + '</p></div>';
  }).join('');

  document.querySelectorAll('.trans-card').forEach(function(el) {
    el.addEventListener('click', async function() {
      const key = this.dataset.key;
      $('#trans-detail').innerHTML = '<div class="loading">Loading ' + key + '...</div>';
      const data = await apiFetch('/v1/transformations/' + key);
      if (!data) { $('#trans-detail').innerHTML = ''; return; }
      const models = (data.models || []).map(modelCard).join('');
      $('#trans-detail').innerHTML = '<h2 style="margin-top:1rem">'
        + esc(data.name) + ' (' + key + ')</h2>'
        + '<p style="color:var(--muted);margin-bottom:0.75rem">' + esc(data.description) + '</p>'
        + '<div class="grid">' + models + '</div>';
    });
  });
})();
</script>
</body>
</html>`;
