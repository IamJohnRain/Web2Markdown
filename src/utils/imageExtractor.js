/**
 * 图片提取模块
 * 负责从HTML内容中识别和提取所有图片信息
 */
class ImageExtractor {
  /**
   * 从HTML中提取所有图片信息
   * @param {string} html - HTML内容
   * @param {string} baseUrl - 页面基础URL
   * @returns {Array<ImageInfo>} 图片信息数组
   */
  extract(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgElements = doc.querySelectorAll('img');
    
    const images = [];
    const urlSet = new Set(); // 用于去重
    
    imgElements.forEach((img, index) => {
      let src = img.getAttribute('src');
      
      if (!src) return;
      
      // 处理URL
      const isBase64 = src.startsWith('data:');
      let absoluteUrl = src;
      
      if (!isBase64) {
        absoluteUrl = this.resolveUrl(src, baseUrl);
        if (!this.validateUrl(absoluteUrl)) return;
      }
      
      // 去重
      if (urlSet.has(absoluteUrl)) return;
      urlSet.add(absoluteUrl);
      
      // 提取图片信息
      const imageInfo = {
        id: this.generateId(absoluteUrl, index),
        originalUrl: src,
        absoluteUrl: absoluteUrl,
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title') || '',
        isBase64: isBase64,
        extension: this.extractExtension(absoluteUrl, isBase64)
      };
      
      images.push(imageInfo);
    });
    
    return images;
  }
  
  /**
   * 验证URL是否合法
   * @param {string} url - URL字符串
   * @returns {boolean} 是否合法
   */
  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      // 仅支持http、https和data协议
      return ['http:', 'https:', 'data:'].includes(urlObj.protocol);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * 将相对URL转换为绝对URL
   * @param {string} url - URL字符串
   * @param {string} baseUrl - 基础URL
   * @returns {string} 绝对URL
   */
  resolveUrl(url, baseUrl) {
    try {
      const absoluteUrl = new URL(url, baseUrl);
      return absoluteUrl.href;
    } catch (e) {
      return url;
    }
  }
  
  /**
   * 从URL或Base64中提取文件扩展名
   * @param {string} url - URL字符串
   * @param {boolean} isBase64 - 是否为Base64编码
   * @returns {string} 扩展名（包含点号，如'.jpg'）
   */
  extractExtension(url, isBase64) {
    if (isBase64) {
      // 从data URI中提取MIME类型
      const match = url.match(/data:image\/(\w+);/);
      if (match) {
        const mimeToExt = {
          'jpeg': '.jpg',
          'jpg': '.jpg',
          'png': '.png',
          'gif': '.gif',
          'webp': '.webp',
          'svg+xml': '.svg',
          'bmp': '.bmp'
        };
        return mimeToExt[match[1]] || '.png';
      }
      return '.png';
    }
    
    // 从URL路径中提取扩展名
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const match = pathname.match(/\.(\w+)(?:\?|$)/);
      if (match) {
        const ext = match[1].toLowerCase();
        const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        return validExts.includes(ext) ? '.' + ext : '.jpg';
      }
    } catch (e) {
      // URL解析失败
    }
    
    return '.jpg';
  }
  
  /**
   * 生成唯一图片ID
   * @param {string} url - URL字符串
   * @param {number} index - 索引
   * @returns {string} 唯一ID
   */
  generateId(url, index) {
    // 使用简单的哈希函数生成ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return 'img_' + Math.abs(hash).toString(36) + '_' + index;
  }
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageExtractor;
}
