// ─── State ───────────────────────────────────────────────────────────────
let urls = [];
let pendingDeleteCode = null;

// ─── Load from API ───────────────────────────────────────────────────────
async function loadURLs() {
  try {
    const r = await fetch('/api/urls', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    urls = await r.json();
    render();
  } catch {
    // silently fail — health check will show status
  }
}

async function checkHealth() {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    dot.className = 'dot' + (r.ok ? ' online' : '');
    txt.textContent = r.ok ? 'API online' : `API error (${r.status})`;
    if (r.ok) {
      loadURLs();
      loadInfo();
    }
  } catch {
    dot.className = 'dot';
    txt.textContent = 'API unreachable';
  }
}

async function loadInfo() {
  try {
    const r = await fetch('/api/info', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return;
    const data = await r.json();

    const studentIdEl = document.getElementById('student-id');
    const buildTimeEl = document.getElementById('build-time');

    if (studentIdEl) studentIdEl.textContent = data.studentId || 'NOT_SET';
    if (buildTimeEl) {
      const buildTime = data.buildTime || 'NOT_SET';
      if (buildTime !== 'NOT_SET') {
        const date = new Date(buildTime);
        buildTimeEl.textContent = date.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } else {
        buildTimeEl.textContent = buildTime;
      }
    }
  } catch {
    // silently fail
  }
}

// ─── Create ──────────────────────────────────────────────────────────────
async function createURL() {
  const urlInput = document.getElementById('input-url');
  const codeInput = document.getElementById('input-code');
  const url = urlInput.value.trim();
  const customCode = codeInput.value.trim();

  if (!url) { toast('Please enter a destination URL', 'error'); return; }
  if (!/^https?:\/\//i.test(url)) { toast('URL must start with http:// or https://', 'error'); return; }

  const btn = document.getElementById('btn-create');
  btn.disabled = true;

  try {
    const body = { url };
    if (customCode) body.customCode = customCode;

    const r = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    const data = await r.json();
    if (!r.ok) { toast(data.error || `Error ${r.status}`, 'error'); return; }

    toast(`/${data.code} created`, 'success');
    urlInput.value = '';
    codeInput.value = '';
    await loadURLs();
  } catch {
    toast('Could not reach API. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── Update ──────────────────────────────────────────────────────────────
function openEditModal(code) {
  const entry = urls.find(u => u.code === code);
  document.getElementById('edit-code').value = code;
  document.getElementById('edit-url').value = entry ? entry.url : '';
  document.getElementById('edit-modal').classList.add('active');
}

async function updateURL() {
  const code = document.getElementById('edit-code').value;
  const newUrl = document.getElementById('edit-url').value.trim();

  if (!newUrl) { toast('URL cannot be empty', 'error'); return; }
  if (!/^https?:\/\//i.test(newUrl)) { toast('URL must start with http:// or https://', 'error'); return; }

  try {
    const r = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl, customCode: code }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await r.json();
    if (!r.ok) { toast(data.error || `Error ${r.status}`, 'error'); return; }

    closeModal();
    toast(`/${code} updated`, 'success');
    await loadURLs();
  } catch {
    toast('Could not reach API', 'error');
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────
function openDeleteModal(code) {
  pendingDeleteCode = code;
  document.getElementById('delete-code-label').textContent = `/${code}`;
  document.getElementById('delete-modal').classList.add('active');
}

async function confirmDelete() {
  if (!pendingDeleteCode) return;
  const code = pendingDeleteCode;
  pendingDeleteCode = null;
  closeModal();

  try {
    const r = await fetch(`/api/${code}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok && r.status !== 404) {
      const data = await r.json().catch(() => ({}));
      toast(data.error || `Error ${r.status}`, 'error');
      return;
    }
  } catch {
    toast('Could not reach API', 'error');
    return;
  }

  toast(`/${code} deleted`, 'success');
  await loadURLs();
}

// ─── Modal ───────────────────────────────────────────────────────────────
function closeModal() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
}
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) closeModal(); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Render ──────────────────────────────────────────────────────────────
function render() {
  const tbody = document.getElementById('url-tbody');
  const empty = document.getElementById('empty-state');

  if (urls.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = urls.map(entry => {
    const short = `/${entry.code}`;
    const full = window.location.origin + short;
    const date = entry.createdAt ? new Date(entry.createdAt) : null;
    const dateStr = date
      ? date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
      : '—';

    return `<tr>
      <td class="url-cell">
        <a href="${esc(entry.url)}" target="_blank" rel="noopener" class="url-text" title="${esc(entry.url)}">${esc(entry.url)}</a>
      </td>
      <td>
        <a href="${esc(full)}" target="_blank" rel="noopener" class="short-link">${esc(short)}</a>
      </td>
      <td style="text-align:right;font-size:.82rem;color:var(--muted);font-variant-numeric:tabular-nums">${entry.clicks ?? 0}</td>
      <td style="color:var(--muted);font-size:.78rem;white-space:nowrap">${dateStr}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Copy short URL" onclick="copyURL('${esc(full)}')">
            <svg width="13" height="13"><use href="icons.svg#icon-copy"/></svg>
          </button>
          <button class="btn-icon" title="Edit" onclick="openEditModal('${esc(entry.code)}')">
            <svg width="13" height="13"><use href="icons.svg#icon-edit"/></svg>
          </button>
          <button class="btn-icon danger" title="Delete" onclick="openDeleteModal('${esc(entry.code)}')">
            <svg width="13" height="13"><use href="icons.svg#icon-trash"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function copyURL(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('Copied!', 'success');
  } catch {
    toast('Copy failed', 'error');
  }
}

function toast(msg, type = 'info') {
  const icons = {
    success: `<svg width="14" height="14" style="color:var(--success)"><use href="icons.svg#icon-check"/></svg>`,
    error:   `<svg width="14" height="14" style="color:var(--danger)"><use href="icons.svg#icon-x"/></svg>`,
    info:    `<svg width="14" height="14" style="color:var(--muted)"><use href="icons.svg#icon-alert"/></svg>`,
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type]}<span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut .25s ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

// ─── Init ────────────────────────────────────────────────────────────────
checkHealth();
setInterval(checkHealth, 30000);

['input-url', 'input-code'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') createURL();
  });
});
