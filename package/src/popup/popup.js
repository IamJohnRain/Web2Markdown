const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const pageTitleEl = document.getElementById('pageTitle');
const pageUrlEl = document.getElementById('pageUrl');

let converter = null;

function init() {
  try {
    if (typeof TurndownService === 'undefined') {
      showStatus('error', 'TurndownService 未加载，请刷新插件');
      return;
    }
    
    converter = new MarkdownConverter();
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        pageTitleEl.textContent = tabs[0].title || '未知页面';
        pageUrlEl.textContent = tabs[0].url || '';
      }
    });
  } catch (error) {
    console.error('Init failed:', error);
    showStatus('error', '初始化失败: ' + error.message);
  }
}

init();

saveBtn.addEventListener('click', async () => {
  try {
    saveBtn.disabled = true;
    showStatus('loading', '正在处理...');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showStatus('error', '无法获取当前标签页');
      saveBtn.disabled = false;
      return;
    }
    
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showStatus('error', '无法处理 Chrome 内部页面');
      saveBtn.disabled = false;
      return;
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content.js']
    });
    
    if (!results || !results[0] || !results[0].result) {
      showStatus('error', '无法提取页面内容');
      saveBtn.disabled = false;
      return;
    }
    
    const { title, html, url } = results[0].result;
    
    const markdown = converter.convert(html, title, url);
    const fileName = converter.sanitizeFileName(title);
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const blobUrl = URL.createObjectURL(blob);
    
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: fileName + '.md',
      saveAs: true
    });
    
    if (downloadId) {
      showStatus('success', `保存成功！文件名: ${fileName}.md`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    showStatus('error', `发生错误: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

function showStatus(type, message) {
  statusDiv.className = `status ${type}`;
  
  if (type === 'success' && message.includes('\n')) {
    const parts = message.split('\n');
    statusDiv.innerHTML = parts[0] + '<br><span class="path">' + parts[1] + '</span>';
  } else {
    statusDiv.textContent = message;
  }
  
  statusDiv.style.display = 'block';
}
