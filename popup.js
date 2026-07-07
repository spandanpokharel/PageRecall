const saveButton = document.getElementById('save-btn');
const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('results');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderResults(entries) {
  if (!entries.length) {
    resultsContainer.innerHTML = '<p>No saved pages yet.</p>';
    return;
  }

  const items = entries.map((entry) => {
    const preview = entry.text ? entry.text.slice(0, 140) : 'No page text captured.';
    return `
      <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <strong>${escapeHtml(entry.title || 'Untitled page')}</strong><br>
        <small>${escapeHtml(entry.url)}</small>
        <p style="margin: 4px 0 0; font-size: 12px;">${escapeHtml(preview)}</p>
      </div>
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

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('No active tab found.');
    }

    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
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
    resultsContainer.innerHTML = `<p style="color: green;">Saved to your local memory.</p>${resultsContainer.innerHTML}`;
  } catch (error) {
    console.error('Failed to save page:', error);
    resultsContainer.innerHTML = '<p style="color: red;">Could not save this page.</p>';
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

saveButton.addEventListener('click', saveCurrentPage);
loadSavedPages();