const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');
const pageTitleEl = document.getElementById('pageTitle');
const pageUrlEl = document.getElementById('pageUrl');
const downloadImagesCheckbox = document.getElementById('downloadImages');

let converter = null;

function init() {
  try {
    if (typeof TurndownService === 'undefined') {
      showStatus('error', 'TurndownService 未加载，请刷新插件');
      return;
    }
    
    converter = new MarkdownConverter();
    
    // 加载用户设置
    loadSettings();
    
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

// 加载用户设置
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['downloadImages']);
    // 如果有保存的设置，使用它；否则保持默认值（checked）
    if (result.downloadImages !== undefined) {
      downloadImagesCheckbox.checked = result.downloadImages;
    }
  } catch (error) {
    console.error('Load settings failed:', error);
  }
}

// 保存用户设置
async function saveSettings() {
  try {
    await chrome.storage.local.set({
      downloadImages: downloadImagesCheckbox.checked
    });
  } catch (error) {
    console.error('Save settings failed:', error);
  }
}

// 监听复选框变化
downloadImagesCheckbox.addEventListener('change', saveSettings);

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
    const fileName = converter.sanitizeFileName(title);
    
    // 先让用户选择保存路径
    showStatus('loading', '请选择保存位置...');
    
    // 创建一个临时的空文件来获取用户选择的路径
    const tempBlob = new Blob([''], { type: 'text/plain' });
    const tempBlobUrl = URL.createObjectURL(tempBlob);
    
    let savePath = null;
    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: tempBlobUrl,
          filename: fileName + '.md',
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });
      
      // 获取用户选择的保存路径
      const downloadItem = await new Promise((resolve) => {
        chrome.downloads.search({ id: downloadId }, (results) => {
          resolve(results && results.length > 0 ? results[0] : null);
        });
      });
      
      if (downloadItem && downloadItem.filename) {
        savePath = downloadItem.filename;
        // 取消临时下载
        await chrome.downloads.cancel(downloadId);
        // 删除临时文件
        await chrome.downloads.erase({ id: downloadId });
      }
    } finally {
      URL.revokeObjectURL(tempBlobUrl);
    }
    
    if (!savePath) {
      showStatus('error', '未选择保存位置');
      saveBtn.disabled = false;
      return;
    }
    
    // 从完整路径中提取目录路径
    const lastSlash = savePath.lastIndexOf('/');
    const lastBackslash = savePath.lastIndexOf('\\');
    const separatorIndex = Math.max(lastSlash, lastBackslash);
    const saveDir = separatorIndex > 0 ? savePath.substring(0, separatorIndex) : '';
    
    // 检查是否需要下载图片
    const shouldDownloadImages = downloadImagesCheckbox.checked;
    
    let markdown;
    let imageStats = null;
    
    if (shouldDownloadImages) {
      // 使用带图片提取的转换方法
      const { markdown: md, images } = converter.convertWithImages(html, title, url);
      markdown = md;
      
      if (images && images.length > 0) {
        showStatus('loading', `发现 ${images.length} 张图片，开始下载...`);
        
        // 创建路径管理器
        const pathManager = new ImagePathManager(fileName);
        const assetsFolder = pathManager.getAssetsFolderName();
        
        // 构建图片保存的完整路径
        const imageSavePath = saveDir ? `${saveDir}/${assetsFolder}` : assetsFolder;
        
        // 创建图片下载器
        const downloader = new ImageDownloader({
          folderName: imageSavePath,
          maxConcurrent: 5,
          timeout: 30000,
          maxRetries: 3
        });
        
        // 设置进度回调
        downloader.setProgressCallback((completed, total, currentImage, result) => {
          const status = result.success ? '✓' : '✗';
          showStatus('loading', `下载图片 ${completed}/${total} ${status}\n${currentImage.absoluteUrl.substring(0, 50)}...`);
        });
        
        // 下载所有图片
        const downloadResults = await downloader.downloadAll(images);
        
        // 更新Markdown中的图片引用
        markdown = pathManager.updateMarkdownReferences(markdown, images, downloadResults);
        
        // 生成统计信息
        imageStats = pathManager.generateStats(downloadResults);
      }
    } else {
      // 不下载图片，使用原有转换方法
      markdown = converter.convert(html, title, url);
    }
    
    // 保存 Markdown 文件到用户选择的路径
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const blobUrl = URL.createObjectURL(blob);
    
    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: blobUrl,
          filename: savePath,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });
      
      if (downloadId) {
        let message = `保存成功！文件名: ${fileName}.md`;
        if (imageStats) {
          message += `\n图片: ${imageStats.success}/${imageStats.total} 成功下载`;
          if (imageStats.failed > 0) {
            message += `，${imageStats.failed} 失败`;
          }
        }
        showStatus('success', message);
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
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
  
  if (message.includes('\n')) {
    const parts = message.split('\n');
    let html = parts[0];
    for (let i = 1; i < parts.length; i++) {
      html += '<br><span class="path">' + parts[i] + '</span>';
    }
    statusDiv.innerHTML = html;
  } else {
    statusDiv.textContent = message;
  }
  
  statusDiv.style.display = 'block';
}
