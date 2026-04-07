# 图片本地存储功能技术设计

## 1. 设计概述

### 1.1 设计目标
将图片本地存储功能集成到现有Web2Markdown Chrome扩展中，实现网页图片的自动下载、本地存储和Markdown引用路径更新，同时保持与现有架构的一致性和可扩展性。

### 1.2 设计原则
- **最小侵入性**: 在现有代码基础上扩展，不破坏现有功能
- **模块化**: 新功能封装为独立模块，职责清晰
- **可配置性**: 提供用户选项控制功能开关
- **容错性**: 优雅处理各种异常情况，不影响主流程
- **类型安全**: 使用明确的类型定义和接口约束

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
├─────────────────────────────────────────────────────────────┤
│  Popup UI                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - 图片处理选项 (checkbox)                            │  │
│  │  - 保存按钮                                           │  │
│  │  - 进度显示                                           │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Core Modules                                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ImageExtractor      - 图片提取与识别                 │  │
│  │  ImageDownloader     - 图片下载管理                   │  │
│  │  ImagePathManager    - 路径管理与引用更新             │  │
│  │  MarkdownConverter   - Markdown转换 (现有，需扩展)    │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Chrome APIs                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  chrome.downloads    - 文件下载                       │  │
│  │  chrome.scripting    - 脚本注入                       │  │
│  │  chrome.tabs         - 标签页管理                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块依赖关系

```
popup.js
    │
    ├──> ImageExtractor (提取图片信息)
    │        │
    │        └──> ImageInfo[] (图片信息数组)
    │
    ├──> ImageDownloader (下载图片)
    │        │
    │        ├──> chrome.downloads API
    │        │
    │        └──> DownloadResult[] (下载结果)
    │
    ├──> ImagePathManager (管理路径)
    │        │
    │        └──> 更新Markdown引用
    │
    └──> MarkdownConverter (转换Markdown)
             │
             └──> TurndownService
```

## 3. 核心模块设计

### 3.1 ImageExtractor - 图片提取器

#### 3.1.1 职责
从HTML内容中提取所有图片信息，包括URL、Alt文本、位置等。

#### 3.1.2 类设计

```typescript
/**
 * 图片信息接口
 */
interface ImageInfo {
  /** 原始图片URL */
  originalUrl: string;
  /** 规范化后的绝对URL */
  absoluteUrl: string;
  /** Alt文本 */
  altText: string;
  /** 图片在HTML中的唯一标识 */
  id: string;
  /** 是否为Base64编码 */
  isBase64: boolean;
  /** Base64数据（如果适用） */
  base64Data?: string;
  /** 图片格式扩展名 */
  extension: string;
}

/**
 * 图片提取器
 */
class ImageExtractor {
  /**
   * 从HTML中提取所有图片信息
   * @param html HTML内容
   * @param baseUrl 基础URL用于解析相对路径
   * @returns 图片信息数组
   */
  extract(html: string, baseUrl: string): ImageInfo[];

  /**
   * 验证URL有效性
   * @param url 图片URL
   * @returns 是否有效
   */
  private validateUrl(url: string): boolean;

  /**
   * 将相对URL转换为绝对URL
   * @param url 原始URL
   * @param baseUrl 基础URL
   * @returns 绝对URL
   */
  private resolveUrl(url: string, baseUrl: string): string;

  /**
   * 从URL或Base64中提取文件扩展名
   * @param url 图片URL或Base64数据
   * @param isBase64 是否为Base64
   * @returns 扩展名（包含点号，如'.jpg'）
   */
  private extractExtension(url: string, isBase64: boolean): string;

  /**
   * 生成图片唯一ID
   * @param url 图片URL
   * @returns 唯一ID
   */
  private generateId(url: string): string;
}
```

#### 3.1.3 算法流程

```
输入: HTML内容, 页面URL
输出: ImageInfo数组

1. 解析HTML为DOM树
2. 查询所有<img>元素
3. 对每个<img>元素:
   a. 提取src属性
   b. 判断是否为Base64编码
   c. 如果是相对路径，转换为绝对路径
   d. 提取alt属性
   e. 推断文件扩展名
   f. 生成唯一ID
   g. 构建ImageInfo对象
4. 去重（基于URL）
5. 返回ImageInfo数组
```

### 3.2 ImageDownloader - 图片下载器

#### 3.2.1 职责
管理图片下载过程，包括并发控制、重试机制、进度跟踪。

#### 3.2.2 类设计

```typescript
/**
 * 下载结果接口
 */
interface DownloadResult {
  /** 图片ID */
  imageId: string;
  /** 是否成功 */
  success: boolean;
  /** 本地文件名（成功时） */
  localFilename?: string;
  /** 本地相对路径（成功时） */
  localPath?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 原始URL */
  originalUrl: string;
}

/**
 * 下载配置接口
 */
interface DownloadConfig {
  /** 目标文件夹名称 */
  folderName: string;
  /** 最大并发数 */
  maxConcurrent: number;
  /** 单个图片超时时间（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * 进度回调函数类型
 */
type ProgressCallback = (completed: number, total: number, currentImage: string) => void;

/**
 * 图片下载器
 */
class ImageDownloader {
  private config: DownloadConfig;
  private progressCallback?: ProgressCallback;

  constructor(config: DownloadConfig);

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: ProgressCallback): void;

  /**
   * 批量下载图片
   * @param images 图片信息数组
   * @returns 下载结果数组
   */
  downloadAll(images: ImageInfo[]): Promise<DownloadResult[]>;

  /**
   * 下载单个图片
   * @param image 图片信息
   * @returns 下载结果
   */
  private downloadOne(image: ImageInfo): Promise<DownloadResult>;

  /**
   * 使用Chrome Downloads API下载
   * @param url 图片URL
   * @param filename 目标文件名
   * @returns 下载ID
   */
  private downloadWithChrome(url: string, filename: string): Promise<number>;

  /**
   * 等待下载完成
   * @param downloadId Chrome下载ID
   * @param timeout 超时时间
   * @returns 是否成功
   */
  private waitForCompletion(downloadId: number, timeout: number): Promise<boolean>;

  /**
   * 保存Base64图片
   * @param base64Data Base64数据
   * @param filename 目标文件名
   * @returns 是否成功
   */
  private saveBase64Image(base64Data: string, filename: string): Promise<boolean>;

  /**
   * 生成唯一文件名
   * @param image 图片信息
   * @param index 图片索引
   * @returns 文件名
   */
  private generateFilename(image: ImageInfo, index: number): string;
}
```

#### 3.2.3 并发控制策略

```
使用信号量(Semaphore)模式控制并发:

1. 初始化信号量为maxConcurrent (默认5)
2. 对每个图片启动下载任务:
   a. 获取信号量 (等待可用槽位)
   b. 执行下载
   c. 释放信号量
3. 等待所有任务完成
4. 返回结果数组
```

### 3.3 ImagePathManager - 路径管理器

#### 3.3.1 职责
管理图片文件命名、路径组织、Markdown引用更新。

#### 3.3.2 类设计

```typescript
/**
 * 路径管理器
 */
class ImagePathManager {
  private markdownFilename: string;
  private assetsFolderName: string;

  constructor(markdownFilename: string);

  /**
   * 获取资源文件夹名称
   * @returns 文件夹名称
   */
  getAssetsFolderName(): string;

  /**
   * 生成图片文件名
   * @param image 图片信息
   * @param index 图片索引
   * @returns 文件名
   */
  generateImageFilename(image: ImageInfo, index: number): string;

  /**
   * 获取图片相对路径
   * @param imageFilename 图片文件名
   * @returns 相对路径
   */
  getRelativePath(imageFilename: string): string;

  /**
   * 更新Markdown中的图片引用
   * @param markdown 原始Markdown内容
   * @param images 图片信息数组
   * @param results 下载结果数组
   * @returns 更新后的Markdown
   */
  updateMarkdownReferences(
    markdown: string,
    images: ImageInfo[],
    results: DownloadResult[]
  ): string;

  /**
   * 清理文件名（移除特殊字符）
   * @param name 原始名称
   * @returns 清理后的名称
   */
  private sanitizeFilename(name: string): string;
}
```

### 3.4 MarkdownConverter 扩展

#### 3.4.1 现有类扩展
在现有`MarkdownConverter`类基础上添加图片处理能力。

```typescript
/**
 * 扩展后的Markdown转换器
 */
class MarkdownConverter {
  // 现有成员...

  /**
   * 设置图片处理模式
   * @param enabled 是否启用图片本地存储
   */
  setImageMode(enabled: boolean): void;

  /**
   * 转换HTML为Markdown（扩展版）
   * @param html HTML内容
   * @param title 页面标题
   * @param url 页面URL
   * @param imageInfos 图片信息数组（可选）
   * @returns Markdown内容和图片信息
   */
  convertWithImages(
    html: string,
    title: string,
    url: string
  ): { markdown: string; images: ImageInfo[] };
}
```

## 4. 数据流设计

### 4.1 主流程数据流

```
用户点击保存按钮
    │
    ▼
读取用户选项 (是否下载图片)
    │
    ▼
提取页面内容 (content.js)
    │
    │ HTML内容
    ▼
转换Markdown (converter.js)
    │
    ├──> 如果启用图片下载:
    │      │
    │      ├──> 提取图片信息 (ImageExtractor)
    │      │        │
    │      │        └──> ImageInfo[]
    │      │
    │      ├──> 下载图片 (ImageDownloader)
    │      │        │
    │      │        ├──> 显示进度
    │      │        │
    │      │        └──> DownloadResult[]
    │      │
    │      └──> 更新引用 (ImagePathManager)
    │               │
    │               └──> 更新后的Markdown
    │
    ▼
保存Markdown文件 (chrome.downloads)
    │
    ▼
显示完成状态
```

### 4.2 图片下载流程

```
ImageInfo[]
    │
    ▼
并发控制 (信号量=5)
    │
    ├──> 任务1: 下载图片1
    ├──> 任务2: 下载图片2
    ├──> 任务3: 下载图片3
    ├──> 任务4: 下载图片4
    └──> 任务5: 下载图片5
         │
         ▼ (槽位释放)
         任务6: 下载图片6
    │
    ▼
收集结果
    │
    ▼
DownloadResult[]
```

## 5. 接口设计

### 5.1 用户界面扩展

#### 5.1.1 Popup HTML扩展

在现有popup.html基础上添加图片处理选项：

```html
<!-- 新增：图片处理选项 -->
<div class="image-options">
  <label class="checkbox-label">
    <input type="checkbox" id="downloadImages" checked>
    <span class="checkbox-custom"></span>
    <span>下载图片到本地</span>
  </label>
  <div class="option-hint">
    图片将保存在Markdown文件同级的资源文件夹中
  </div>
</div>
```

#### 5.1.2 样式扩展

```css
.image-options {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  color: #202124;
}

.option-hint {
  margin-top: 8px;
  font-size: 11px;
  color: #5f6368;
  padding-left: 28px;
}
```

### 5.2 进度显示接口

```typescript
/**
 * 进度状态接口
 */
interface ProgressState {
  /** 当前阶段 */
  stage: 'extracting' | 'downloading' | 'converting' | 'saving';
  /** 已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 当前处理项 */
  currentItem?: string;
  /** 状态消息 */
  message: string;
}

/**
 * 显示进度
 */
function showProgress(state: ProgressState): void;
```

## 6. 存储设计

### 6.1 文件组织结构

```
用户选择的保存位置/
├── article_name.md           (Markdown文件)
└── article_name_assets/      (图片文件夹)
    ├── image_001.jpg
    ├── image_002.png
    ├── image_003.gif
    └── ...
```

### 6.2 文件命名规则

#### 6.2.1 图片文件夹命名
- 格式: `{markdown_filename}_assets`
- 清理规则: 移除特殊字符，空格替换为下划线

#### 6.2.2 图片文件命名
- 优先使用原始URL中的文件名
- 如果URL无文件名，使用`image_{index}.{ext}`
- 添加序号避免冲突: `{name}_{index}.{ext}`
- 长度限制: 200字符

### 6.3 Chrome Storage使用

使用`chrome.storage.local`存储用户偏好设置：

```typescript
/**
 * 用户设置接口
 */
interface UserSettings {
  /** 是否启用图片下载 */
  downloadImages: boolean;
  /** 最大并发数 */
  maxConcurrent: number;
  /** 下载超时时间 */
  downloadTimeout: number;
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: UserSettings = {
  downloadImages: true,
  maxConcurrent: 5,
  downloadTimeout: 30000
};
```

## 7. 错误处理设计

### 7.1 错误类型定义

```typescript
/**
 * 图片处理错误类型
 */
enum ImageErrorType {
  /** URL无效 */
  INVALID_URL = 'INVALID_URL',
  /** 下载失败 */
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  /** 超时 */
  TIMEOUT = 'TIMEOUT',
  /** 跨域限制 */
  CORS_ERROR = 'CORS_ERROR',
  /** 文件过大 */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  /** 磁盘空间不足 */
  DISK_FULL = 'DISK_FULL'
}

/**
 * 图片处理错误
 */
class ImageProcessError extends Error {
  constructor(
    public type: ImageErrorType,
    public imageUrl: string,
    message: string
  ) {
    super(message);
  }
}
```

### 7.2 错误处理策略

| 错误类型 | 处理策略 | 用户提示 |
|---------|---------|---------|
| INVALID_URL | 跳过该图片，保留原始URL | "图片URL无效，已保留原始链接" |
| DOWNLOAD_FAILED | 重试3次，失败后保留原始URL | "图片下载失败，已保留原始链接" |
| TIMEOUT | 重试3次，失败后保留原始URL | "图片下载超时，已保留原始链接" |
| CORS_ERROR | 保留原始URL | "跨域图片无法下载，已保留原始链接" |
| FILE_TOO_LARGE | 询问用户是否继续 | "图片大小超过10MB，是否继续下载？" |
| DISK_FULL | 终止下载，提示用户 | "磁盘空间不足，请清理后重试" |

## 8. 性能优化设计

### 8.1 并发下载优化
- 使用信号量控制并发数（默认5）
- 动态调整并发数基于网络状况
- 避免同时下载过多导致浏览器限制

### 8.2 去重优化
- 基于URL哈希进行去重
- 避免重复下载相同图片
- 减少网络请求和存储空间

### 8.3 内存优化
- 流式下载大文件
- 避免一次性加载所有图片数据到内存
- 及时释放不再需要的数据

## 9. 安全性设计

### 9.1 URL验证
- 检查URL协议（仅允许http/https/data）
- 防止JavaScript协议注入
- 验证URL格式合法性

### 9.2 文件名安全
- 移除路径遍历字符（../）
- 移除特殊字符（<>:"/\|?*）
- 限制文件名长度

### 9.3 下载安全
- 使用Chrome Downloads API（受浏览器安全策略保护）
- 不直接执行任何下载的文件
- 遵循用户选择的保存位置

## 10. 兼容性设计

### 10.1 向后兼容
- 新功能默认启用，但可关闭
- 关闭时行为与现有版本一致
- 不影响现有文字转换功能

### 10.2 浏览器兼容
- 仅支持Chrome/Edge (Manifest V3)
- 使用Chrome特定API (chrome.downloads)
- 不支持Firefox (Manifest V2差异)

## 11. 测试策略

### 11.1 单元测试
- ImageExtractor: 测试各种URL格式解析
- ImageDownloader: 测试并发控制和重试机制
- ImagePathManager: 测试路径生成和引用更新

### 11.2 集成测试
- 完整流程测试：从HTML到Markdown+图片
- 错误场景测试：网络错误、跨域、大文件等
- 用户交互测试：选项切换、进度显示

### 11.3 端到端测试
- 真实网页测试：包含各种图片格式
- 性能测试：大量图片下载
- 兼容性测试：不同网站结构

## 12. 部署方案

### 12.1 文件结构
```
src/
├── utils/
│   ├── converter.js        (现有，需修改)
│   ├── fileSaver.js        (现有)
│   ├── imageExtractor.js   (新增)
│   ├── imageDownloader.js  (新增)
│   └── imagePathManager.js (新增)
├── popup/
│   ├── popup.html          (现有，需修改)
│   ├── popup.js            (现有，需修改)
│   └── popup.css           (新增，样式分离)
├── content.js              (现有)
└── background.js           (现有)
```

### 12.2 Manifest更新
无需修改manifest.json，现有权限已满足需求：
- `downloads`: 已声明
- `activeTab`: 已声明
- `scripting`: 已声明
- `<all_urls>`: 已声明

## 13. 监控与日志

### 13.1 日志级别
- DEBUG: 详细调试信息（开发环境）
- INFO: 关键操作信息（下载开始/完成）
- WARN: 警告信息（部分图片失败）
- ERROR: 错误信息（严重错误）

### 13.2 关键指标
- 图片提取数量
- 下载成功/失败数量
- 总下载时间
- 平均单图下载时间
- 错误类型分布
