// Client script for Novel Reader
(() => {
  const $ = id => document.getElementById(id);

  const urlInput = $('urlInput');
  const extractBtn = $('extractBtn');
  const scrapeBookBtn = $('scrapeBookBtn');
  const lockPattern = $('lockPattern');
  const preview = $('extractedText');
  const extractStatus = $('statusIndicator');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const copyBtn = $('copyBtn');
  const libreranslateBtn = $('libreranslateBtn');
  const wordCountEl = $('wordCount');
  const historyList = $('urlHistoryList');
  const clearHistoryBtn = $('clearHistoryBtn');
  const progressBar = $('progressBar');
  const chapterDisplay = $('chapterDisplay');
  const forceExtract = $('forceExtract');

  let chapters = []; // array of {idx,url,title,content}
  let currentIdx = 0;
  let urlHistory = JSON.parse(localStorage.getItem('urlHistory') || '[]');
  let lastBookKey = null;

  function setStatus(msg, kind='') {
    extractStatus.textContent = msg || '';
    extractStatus.style.color = kind === 'error' ? '#ef4444' : (kind === 'success' ? '#16a34a' : '');
  }

  function saveBookToLocal(key, chs) {
    localStorage.setItem(`book:${key}:chapters`, JSON.stringify(chs));
  }

  function loadBookFromLocal(key) {
    return JSON.parse(localStorage.getItem(`book:${key}:chapters`) || 'null') || null;
  }

  function computeBookKey(prefix) {
    try { const u = new URL(prefix); return `${u.host}${u.pathname}`.replace(/[^a-z0-9]+/gi,'_'); } catch { return prefix.replace(/[^a-z0-9]+/gi,'_'); }
  }

  function renderHistory() {
    historyList.innerHTML = '';
    (urlHistory || []).forEach(u => {
      const li = document.createElement('li'); li.textContent = u;
      li.addEventListener('click', ()=> { urlInput.value = u; extractBtn.disabled = false; });
      historyList.appendChild(li);
    });
  }
  renderHistory();
  clearHistoryBtn.addEventListener('click', () => { urlHistory = []; localStorage.removeItem('urlHistory'); renderHistory(); });

  urlInput.addEventListener('input', () => extractBtn.disabled = !urlInput.value.trim());

  extractBtn.addEventListener('click', async () => {
    const u = urlInput.value.trim();
    if (!u) return;
    setStatus('Detecting pattern...', '');
    await extractSingle(u, !!forceExtract.checked);
  });

  scrapeBookBtn.addEventListener('click', async () => {
    const startUrl = urlInput.value.trim();
    if (!startUrl) return setStatus('Enter starting chapter URL', 'error');
    setStatus('Scraping book (this may take a while)...');
    try {
      const payload = { url: startUrl, maxChapters: 4000 };
      const resp = await fetch('/api/scrape', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await resp.json();
      if (j.status === 'success') {
        chapters = j.chapters || [];
        if (!chapters.length) return setStatus('No chapters found', 'error');
        lastBookKey = computeBookKey(startUrl);
        saveBookToLocal(lastBookKey, chapters);
        localStorage.setItem(`book:meta:${lastBookKey}`, JSON.stringify({ title: chapters[0]?.title || 'Book', chapters: chapters.length, lastUrl: startUrl }));
        currentIdx = 0;
        renderChapter();
        setStatus(`Saved ${chapters.length} chapters locally`, 'success');
        addToHistory(startUrl);
      } else {
        setStatus(j.message || 'Scrape failed', 'error');
      }
    } catch (e) {
      console.error(e);
      setStatus('Scrape request failed', 'error');
    }
  });

  async function extractSingle(url, force=false) {
    setStatus('Extracting...');
    try {
      // Try local cache first (if it's a stored book)
      const bookKey = computeBookKey(url);
      const cached = loadBookFromLocal(bookKey);
      if (cached && !force) {
        chapters = cached;
        lastBookKey = bookKey;
        currentIdx = 0;
        renderChapter();
        setStatus('Loaded from local cache', 'success');
        return;
      }

      const res = await fetch('/api/scrape', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url, maxChapters: 1 }) });
      const j = await res.json();
      if (j.status === 'success' && Array.isArray(j.chapters)) {
        chapters = j.chapters;
        lastBookKey = computeBookKey(url);
        saveBookToLocal(lastBookKey, chapters);
        currentIdx = 0;
        renderChapter();
        setStatus('Extraction successful', 'success');
        addToHistory(url);
      } else {
        setStatus(j.message || 'Extraction failed', 'error');
      }
    } catch (err) {
      console.error(err);
      setStatus('Network error', 'error');
    }
  }

  function renderChapter() {
    if (!chapters || !chapters.length) {
      preview.textContent = 'No content.';
      wordCountEl.textContent = '0 words';
      progressBar.style.width = '0%';
      prevBtn.disabled = true; nextBtn.disabled = true;
      chapterDisplay.textContent = '';
      return;
    }
    const ch = chapters[currentIdx];
    preview.textContent = ch.content || '(empty)';
    wordCountEl.textContent = `${(ch.content||'').trim().split(/\s+/).filter(Boolean).length} words`;
    prevBtn.disabled = currentIdx <= 0;
    nextBtn.disabled = currentIdx >= chapters.length - 1;
    const p = Math.round(((currentIdx + 1) / chapters.length) * 100);
    progressBar.style.width = `${p}%`;
    chapterDisplay.textContent = `Ch ${ch.idx} • ${currentIdx+1}/${chapters.length}`;
    // persist last read
    if (lastBookKey) {
      const meta = JSON.parse(localStorage.getItem(`book:meta:${lastBookKey}`) || '{}');
      meta.lastChapter = ch.idx;
      meta.lastUrl = ch.url;
      localStorage.setItem(`book:meta:${lastBookKey}`, JSON.stringify(meta));
    }
  }

  prevBtn.addEventListener('click', async () => {
    if (currentIdx > 0) { currentIdx--; renderChapter(); }
  });
  nextBtn.addEventListener('click', async () => {
    if (currentIdx < chapters.length - 1) { currentIdx++; renderChapter(); }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(preview.textContent || '');
    setStatus('Copied to clipboard', 'success');
  });

  libreranslateBtn.addEventListener('click', async () => {
    const text = preview.textContent || '';
    if (!text.trim()) return setStatus('No text to translate', 'error');
    setStatus('Translating...');
    try {
      const r = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ q: text, source: 'auto', target: 'en' }) });
      const j = await r.json();
      if (j.status === 'success') {
        preview.textContent = j.translatedText;
        wordCountEl.textContent = `${(j.translatedText||'').trim().split(/\s+/).filter(Boolean).length} words`;
        setStatus('Translation ready', 'success');
      } else {
        setStatus(j.message || 'Translation failed', 'error');
      }
    } catch (e) {
      console.error(e);
      setStatus('Translate request failed', 'error');
    }
  });

  function addToHistory(url) {
    if (!url) return;
    urlHistory = JSON.parse(localStorage.getItem('urlHistory') || '[]');
    if (!urlHistory.includes(url)) {
      urlHistory.unshift(url);
      if (urlHistory.length > 50) urlHistory = urlHistory.slice(0, 50);
      localStorage.setItem('urlHistory', JSON.stringify(urlHistory));
    }
    renderHistory();
  }

  // Load last saved book meta on init
  (function initFromQuery(){
    const params = new URLSearchParams(location.search);
    const u = params.get('url');
    if (u) { urlInput.value = decodeURIComponent(u); extractBtn.disabled = false; }
    // If local meta exists, show last read
    const keys = Object.keys(localStorage).filter(k => k.startsWith('book:meta:'));
    if (keys.length) {
      const k = keys[0];
      const meta = JSON.parse(localStorage.getItem(k) || '{}');
      if (meta && meta.lastUrl) {
        // load last book if user wants
      }
    }
  })();

})();