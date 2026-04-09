/**
 * 文件保存模块 - 使用 Chrome Downloads API
 * 将 Markdown 文件和图片保存到同一目录
 */
class FileSaver {
  constructor() {
    this.assetsFolderName = 'images';
    this.baseFolderName = '';
  }

  /**
   * 生成基础文件夹名称（基于页面标题）
   * @param {string} fileName - 文件名（不含扩展名）
   */
  setBaseFolderName(fileName) {
    // 限制长度，避免文件名过长
    this.baseFolderName = fileName.length > 50 ? fileName.substring(0, 50) : fileName;
  }

  /**
   * 获取 Markdown 文件的保存路径
   * @param {string} fileName - 文件名（不含扩展名）
   * @returns {string} 保存路径
   */
  getMarkdownPath(fileName) {
    if (this.baseFolderName) {
      return `${this.baseFolderName}/${fileName}.md`;
    }
    return `${fileName}.md`;
  }

  /**
   * 获取图片文件夹的路径
   * @returns {string} 图片文件夹路径
   */
  getImageFolderPath() {
    if (this.baseFolderName) {
      return `${this.baseFolderName}/${this.assetsFolderName}`;
    }
    return this.assetsFolderName;
  }

  /**
   * 保存 Markdown 文件
   * @param {string} content - Markdown 内容
   * @param {string} fileName - 文件名（不含扩展名）
   * @returns {Promise<Object>} 保存结果，包含 downloadId
   */
  async saveMarkdown(content, fileName) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const blobUrl = URL.createObjectURL(blob);

      const savePath = this.getMarkdownPath(fileName);

      chrome.downloads.download({
        url: blobUrl,
        filename: savePath,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        URL.revokeObjectURL(blobUrl);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({ success: true, downloadId, path: savePath });
        }
      });
    });
  }

  /**
   * 等待下载完成
   * @param {number} downloadId - 下载 ID
   * @returns {Promise<void>}
   */
  waitForDownload(downloadId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error('Download timeout'));
      }, 30000);

      const listener = (delta) => {
        if (delta.id !== downloadId) return;

        if (delta.state) {
          if (delta.state.current === 'complete') {
            clearTimeout(timeout);
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          } else if (delta.state.current === 'interrupted') {
            clearTimeout(timeout);
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error('Download interrupted'));
          }
        }
      };

      chrome.downloads.onChanged.addListener(listener);
    });
  }

  /**
   * 下载并保存单张图片
   * @param {Object} image - 图片信息对象
   * @returns {Promise<Object>} 下载结果
   */
  async downloadImage(image) {
    try {
      const filename = image.id + image.extension;
      const imageFolder = this.getImageFolderPath();
      const fullPath = imageFolder + '/' + filename;

      let downloadId;

      if (image.isBase64) {
        // 处理 Base64 图片
        const response = await fetch(image.absoluteUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        downloadId = await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: blobUrl,
            filename: fullPath,
            saveAs: false,
            conflictAction: 'uniquify'
          }, (id) => {
            URL.revokeObjectURL(blobUrl);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          });
        });
      } else {
        // 处理普通 URL 图片
        downloadId = await new Promise((resolve, reject) => {
          chrome.downloads.download({
            url: image.absoluteUrl,
            filename: fullPath,
            saveAs: false,
            conflictAction: 'uniquify'
          }, (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          });
        });
      }

      await this.waitForDownload(downloadId);

      // 返回相对路径（相对于 MD 文件位置）
      const relativePath = this.baseFolderName
        ? `${this.assetsFolderName}/${filename}`
        : `${this.assetsFolderName}/${filename}`;

      return {
        imageId: image.id,
        success: true,
        localPath: relativePath,
        filename: filename
      };
    } catch (error) {
      console.error('Download image failed:', image.absoluteUrl, error);
      return {
        imageId: image.id,
        success: false,
        error: error.message || 'Download failed',
        localPath: null
      };
    }
  }

  /**
   * 批量下载图片
   * @param {Array<Object>} images - 图片信息数组
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array<Object>>} 下载结果数组
   */
  async downloadImages(images, progressCallback = null) {
    const results = [];
    const maxConcurrent = 3;
    let completed = 0;
    const total = images.length;

    const downloadWithConcurrency = async () => {
      const executing = [];

      for (const image of images) {
        if (executing.length >= maxConcurrent) {
          await Promise.race(executing);
        }

        const promise = this.downloadImage(image).then(result => {
          results.push(result);
          completed++;

          if (progressCallback) {
            progressCallback(completed, total, image, result);
          }

          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });

        executing.push(promise);
      }

      await Promise.all(executing);
    };

    await downloadWithConcurrency();
    return results;
  }

  /**
   * 重新保存更新后的 Markdown 文件
   * @param {string} content - 更新后的内容
   * @param {string} fileName - 文件名（不含扩展名）
   */
  async updateMarkdown(content, fileName) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const blobUrl = URL.createObjectURL(blob);

      const savePath = this.getMarkdownPath(fileName);

      chrome.downloads.download({
        url: blobUrl,
        filename: savePath,
        saveAs: false,
        conflictAction: 'overwrite'
      }, (downloadId) => {
        URL.revokeObjectURL(blobUrl);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    });
  }

  /**
   * 复制文本到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }
}

// 导出到全局作用域供 popup.js 使用
if (typeof window !== 'undefined') {
  window.FileSaver = FileSaver;
}

// 导出给 Node.js 测试使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileSaver;
}
