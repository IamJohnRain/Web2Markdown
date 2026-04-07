/**
 * 图片下载模块
 * 负责并发下载图片、进度跟踪、错误重试
 */
class ImageDownloader {
  /**
   * 构造函数
   * @param {Object} config - 配置选项
   * @param {string} config.folderName - 保存文件夹名称
   * @param {number} config.maxConcurrent - 最大并发数（默认5）
   * @param {number} config.timeout - 超时时间（毫秒，默认30000）
   * @param {number} config.maxRetries - 最大重试次数（默认3）
   */
  constructor(config = {}) {
    this.folderName = config.folderName || 'images';
    this.maxConcurrent = config.maxConcurrent || 5;
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.progressCallback = null;
  }
  
  /**
   * 设置进度回调函数
   * @param {Function} callback - 回调函数 (completed, total, currentImage)
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }
  
  /**
   * 下载所有图片
   * @param {Array<ImageInfo>} images - 图片信息数组
   * @returns {Promise<Array<DownloadResult>>} 下载结果数组
   */
  async downloadAll(images) {
    const results = [];
    let completed = 0;
    const total = images.length;
    
    // 并发控制
    const downloadWithConcurrency = async () => {
      const executing = [];
      
      for (const image of images) {
        // 如果达到并发限制，等待一个任务完成
        if (executing.length >= this.maxConcurrent) {
          await Promise.race(executing);
        }
        
        const promise = this.downloadOne(image).then(result => {
          results.push(result);
          completed++;
          
          // 调用进度回调
          if (this.progressCallback) {
            this.progressCallback(completed, total, image, result);
          }
          
          // 从执行队列中移除
          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });
        
        executing.push(promise);
      }
      
      // 等待所有任务完成
      await Promise.all(executing);
    };
    
    await downloadWithConcurrency();
    return results;
  }
  
  /**
   * 下载单个图片
   * @param {ImageInfo} image - 图片信息
   * @returns {Promise<DownloadResult>} 下载结果
   */
  async downloadOne(image) {
    let lastError = null;
    
    // 重试机制
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (image.isBase64) {
          return await this.downloadBase64(image);
        } else {
          return await this.downloadUrl(image);
        }
      } catch (error) {
        lastError = error;
        
        // 如果不是最后一次尝试，等待一段时间后重试
        if (attempt < this.maxRetries) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }
    
    // 所有重试都失败
    return {
      imageId: image.id,
      success: false,
      error: lastError?.message || 'Download failed',
      localPath: null
    };
  }
  
  /**
   * 下载URL图片
   * @param {ImageInfo} image - 图片信息
   * @returns {Promise<DownloadResult>} 下载结果
   */
  async downloadUrl(image) {
    const filename = this.generateFilename(image);
    const fullPath = this.folderName + '/' + filename;
    
    // 使用Chrome Downloads API
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: image.absoluteUrl,
        filename: fullPath,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    });
    
    // 等待下载完成
    await this.waitForCompletion(downloadId);
    
    return {
      imageId: image.id,
      success: true,
      localPath: fullPath,
      filename: filename
    };
  }
  
  /**
   * 下载Base64图片
   * @param {ImageInfo} image - 图片信息
   * @returns {Promise<DownloadResult>} 下载结果
   */
  async downloadBase64(image) {
    const filename = this.generateFilename(image);
    const fullPath = this.folderName + '/' + filename;
    
    // Base64转Blob
    const response = await fetch(image.absoluteUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    try {
      // 使用Chrome Downloads API
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: blobUrl,
          filename: fullPath,
          saveAs: false,
          conflictAction: 'uniquify'
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });
      
      // 等待下载完成
      await this.waitForCompletion(downloadId);
      
      return {
        imageId: image.id,
        success: true,
        localPath: fullPath,
        filename: filename
      };
    } finally {
      // 清理Blob URL
      URL.revokeObjectURL(blobUrl);
    }
  }
  
  /**
   * 等待下载完成
   * @param {number} downloadId - 下载ID
   * @returns {Promise<void>}
   */
  waitForCompletion(downloadId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error('Download timeout'));
      }, this.timeout);
      
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
        
        if (delta.error) {
          clearTimeout(timeout);
          chrome.downloads.onChanged.removeListener(listener);
          reject(new Error(delta.error.current));
        }
      };
      
      chrome.downloads.onChanged.addListener(listener);
    });
  }
  
  /**
   * 生成文件名
   * @param {ImageInfo} image - 图片信息
   * @returns {string} 文件名
   */
  generateFilename(image) {
    // 使用ID作为文件名，保留扩展名
    return image.id + image.extension;
  }
  
  /**
   * 延迟函数
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageDownloader;
}
