const saveButton = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results');
const statusElement = document.getElementById('status');
const themeToggle = document.getElementById('theme-toggle');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`.trim();
}

async function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  await browser.storage.local.set({ theme });
}

async function initTheme() {
  const { theme = 'light' } = await browser.storage.local.get('theme');
  await applyTheme(theme);
}

function renderResults(entries) {
  if (!entries.length) {
    resultsContainer.innerHTML = '<div class="empty-state">No memories saved yet. Save a page to build your private library.</div>';
    return;
  }

  const items = entries.map((entry) => {
    const preview = entry.text ? entry.text.slice(0, 140) : 'No page text captured.';
    return `
      <article class="memory-card">
        <strong>${escapeHtml(entry.title || 'Untitled page')}</strong>
        <span class="memory-url">${escapeHtml(entry.url)}</span>
        <p class="memory-preview">${escapeHtml(preview)}</p>
      </article>
    `;
  }).join('');

  resultsContainer.innerHTML = items;
}

async function loadSavedPages() {
  const { pages = {} } = await browser.storage.local.get('pages');
  const entries = Object.values(pages)
    .filter(Boolean)
    .sort((a, b) => b.savedAt - a.savedAt);

  renderResults(entries);
  return entries;
}

async function saveCurrentPage() {
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';
  showStatus('Capturing page contents…', '');

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('No active tab found.');
    }

    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content.js']
    });

    const pageData = results?.[0]?.result;

    if (!pageData?.url) {
      throw new Error('Could not read page data.');
    }

    const entry = {
      title: pageData.title || 'Untitled page',
      url: pageData.url,
      text: pageData.text || '',
      savedAt: Date.now()
    };

    const { pages = {} } = await browser.storage.local.get('pages');
    pages[entry.url] = entry;

    await browser.storage.local.set({ pages });
    await loadSavedPages();
    showStatus('Saved to your local memory.', 'success');
  } catch (error) {
    console.error('Failed to save page:', error);
    showStatus('Could not save this page.', 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Remember This Page';
  }
}

searchInput.addEventListener('input', async () => {
  const query = searchInput.value.trim().toLowerCase();
  const entries = await loadSavedPages();

  if (!query) {
    renderResults(entries);
    return;
  }

  const filtered = entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.url} ${entry.text}`.toLowerCase();
    return haystack.includes(query);
  });

  renderResults(filtered);
});

themeToggle.addEventListener('click', async () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  await applyTheme(nextTheme);
});

saveButton.addEventListener('click', saveCurrentPage);
initTheme();
loadSavedPages();