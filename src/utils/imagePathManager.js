/**
 * 路径管理模块
 * 负责文件命名、路径组织和Markdown引用更新
 */
class ImagePathManager {
  /**
   * 构造函数
   * @param {string} markdownFilename - Markdown文件名（不含扩展名）
   */
  constructor(markdownFilename) {
    this.markdownFilename = this.sanitizeFilename(markdownFilename);
  }
  
  /**
   * 获取资源文件夹名称
   * @returns {string} 文件夹名称
   */
  getAssetsFolderName() {
    return 'images';
  }
  
  /**
   * 生成图片文件名
   * @param {ImageInfo} image - 图片信息
   * @param {number} index - 图片索引
   * @returns {string} 文件名
   */
  generateImageFilename(image, index) {
    // 优先使用alt文本作为文件名
    let baseName = image.alt || 'image';
    baseName = this.sanitizeFilename(baseName);
    
    // 限制长度
    if (baseName.length > 50) {
      baseName = baseName.substring(0, 50);
    }
    
    // 添加索引确保唯一性
    return baseName + '_' + index + image.extension;
  }
  
  /**
   * 获取相对路径
   * @param {string} imageFilename - 图片文件名
   * @returns {string} 相对路径
   */
  getRelativePath(imageFilename) {
    const folderName = this.getAssetsFolderName();
    return folderName + '/' + imageFilename;
  }
  
  /**
   * 清理文件名中的特殊字符
   * @param {string} name - 原始文件名
   * @returns {string} 清理后的文件名
   */
  sanitizeFilename(name) {
    if (!name) return 'unnamed';
    
    // 移除Windows文件名中的非法字符
    let sanitized = name.replace(/[<>:"\/\\|?*]/g, '');
    
    // 替换空格为下划线
    sanitized = sanitized.replace(/\s+/g, '_');
    
    // 移除连续的下划线
    sanitized = sanitized.replace(/_+/g, '_');
    
    // 移除首尾的下划线和点
    sanitized = sanitized.replace(/^[_\.]+|[_\.]+$/g, '');
    
    // 如果清理后为空，使用默认名称
    if (!sanitized) {
      sanitized = 'unnamed';
    }
    
    // 限制长度（保留扩展名的空间）
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }
    
    return sanitized;
  }
  
  /**
   * 更新Markdown中的图片引用
   * @param {string} markdown - Markdown内容
   * @param {Array<ImageInfo>} images - 图片信息数组
   * @param {Array<DownloadResult>} downloadResults - 下载结果数组
   * @returns {string} 更新后的Markdown内容
   */
  updateMarkdownReferences(markdown, images, downloadResults) {
    // 创建URL到下载结果的映射
    const urlToResult = new Map();
    downloadResults.forEach((result, index) => {
      const image = images[index];
      if (image && result.success) {
        urlToResult.set(image.absoluteUrl, result);
        // 也映射原始URL（可能是相对路径）
        if (image.originalUrl !== image.absoluteUrl) {
          urlToResult.set(image.originalUrl, result);
        }
      }
    });
    
    // 匹配Markdown图片语法: ![alt](url "title") 或 ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
    
    let updatedMarkdown = markdown;
    let match;
    const replacements = [];
    
    // 收集所有匹配和替换
    while ((match = imageRegex.exec(markdown)) !== null) {
      const [fullMatch, alt, url, title] = match;
      
      // 查找对应的下载结果
      const result = urlToResult.get(url);
      
      if (result && result.success) {
        // 构建新的图片引用
        const titlePart = title ? ` "${title}"` : '';
        const newReference = `![${alt}](${result.localPath}${titlePart})`;
        
        replacements.push({
          start: match.index,
          end: match.index + fullMatch.length,
          replacement: newReference
        });
      }
    }
    
    // 从后向前替换，避免位置偏移
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end, replacement } = replacements[i];
      updatedMarkdown = updatedMarkdown.substring(0, start) + 
                        replacement + 
                        updatedMarkdown.substring(end);
    }
    
    return updatedMarkdown;
  }
  
  /**
   * 生成下载统计信息
   * @param {Array<DownloadResult>} results - 下载结果数组
   * @returns {Object} 统计信息
   */
  generateStats(results) {
    const total = results.length;
    const success = results.filter(r => r.success).length;
    const failed = total - success;
    
    return {
      total,
      success,
      failed,
      successRate: total > 0 ? (success / total * 100).toFixed(1) : 0
    };
  }
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImagePathManager;
}
