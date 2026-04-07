# 图片本地存储功能编码任务规划

## 任务概述

本任务规划将图片本地存储功能分解为可执行的编码任务，按照依赖关系组织，确保逐步实现完整功能。

**总任务数**: 8个主任务，18个子任务
**预计工作量**: 2-3天
**技术栈**: JavaScript (ES6+), Chrome Extension APIs, Turndown.js

---

## 任务1: 创建图片提取模块 (ImageExtractor)

### 任务描述
创建独立的图片提取模块，负责从HTML内容中识别和提取所有图片信息。

### 输入
- HTML内容字符串
- 页面基础URL

### 输出
- `src/utils/imageExtractor.js` 文件

### 验收标准
- 能够识别HTML中所有`<img>`标签
- 正确处理相对路径转换为绝对路径
- 支持Base64编码图片识别
- 提取图片Alt文本
- 生成唯一图片ID
- 去除重复URL

### 子任务

#### 1.1 创建ImageExtractor类基础结构
**描述**: 创建类文件并定义核心接口

**实现要点**:
```javascript
class ImageExtractor {
  extract(html, baseUrl) { ... }
  validateUrl(url) { ... }
  resolveUrl(url, baseUrl) { ... }
  extractExtension(url, isBase64) { ... }
  generateId(url) { ... }
}
```

**代码生成提示**:
创建 `src/utils/imageExtractor.js`，定义ImageExtractor类，实现extract方法框架，使用DOMParser解析HTML，querySelectorAll查询所有img元素。

#### 1.2 实现URL处理逻辑
**描述**: 实现URL验证、解析和规范化功能

**实现要点**:
- 判断URL是否为Base64编码（data:开头）
- 使用URL构造函数解析相对路径
- 验证URL协议（仅http/https/data）
- 处理URL编码问题

**代码生成提示**:
实现resolveUrl方法，使用new URL(url, baseUrl)解析相对路径。实现validateUrl方法，检查URL协议和格式合法性。

#### 1.3 实现图片信息提取
**描述**: 从img元素提取完整信息并构建ImageInfo对象

**实现要点**:
- 提取src属性
- 提取alt属性
- 推断文件扩展名（从URL或Base64 MIME类型）
- 生成唯一ID（基于URL哈希或索引）
- 实现去重逻辑（使用Set存储已见URL）

**代码生成提示**:
在extract方法中遍历所有img元素，构建ImageInfo对象数组。使用Set进行URL去重。实现extractExtension方法从URL或data URI中提取扩展名。

---

## 任务2: 创建图片下载模块 (ImageDownloader)

### 任务描述
创建图片下载管理模块，实现并发下载、进度跟踪、错误重试等功能。

### 输入
- ImageInfo数组
- 下载配置（文件夹名、并发数、超时时间）

### 输出
- `src/utils/imageDownloader.js` 文件

### 验收标准
- 支持并发下载（默认5个并发）
- 实现下载进度回调
- 支持下载失败重试（最多3次）
- 正确处理Base64图片保存
- 生成唯一文件名
- 返回下载结果数组

### 子任务

#### 2.1 创建ImageDownloader类基础结构
**描述**: 创建类文件并定义核心接口和配置

**实现要点**:
```javascript
class ImageDownloader {
  constructor(config) { ... }
  setProgressCallback(callback) { ... }
  downloadAll(images) { ... }
  downloadOne(image) { ... }
}
```

**代码生成提示**:
创建 `src/utils/imageDownloader.js`，定义ImageDownloader类，构造函数接收config对象（folderName, maxConcurrent, timeout, maxRetries），设置默认值。

#### 2.2 实现并发控制机制
**描述**: 实现信号量模式的并发控制

**实现要点**:
- 使用Promise + 计数器实现简单信号量
- 控制同时运行的下载任务数
- 任务完成后释放槽位
- 等待所有任务完成

**代码生成提示**:
实现downloadAll方法，使用Promise.all配合async/await管理并发。可以创建辅助函数limitConcurrency控制并发数量，每次下载前获取槽位，完成后释放。

#### 2.3 实现单个图片下载逻辑
**描述**: 实现单个图片的下载流程，包括Chrome API调用和重试

**实现要点**:
- 使用chrome.downloads.download API
- 等待下载完成事件
- 实现超时控制
- 实现重试逻辑（最多3次）
- 处理Base64图片特殊保存

**代码生成提示**:
实现downloadOne方法，调用chrome.downloads.download启动下载。实现waitForCompletion方法监听chrome.downloads.onChanged事件。使用Promise.race实现超时控制。失败时重试最多3次。

#### 2.4 实现进度跟踪和回调
**描述**: 实现下载进度跟踪和用户回调通知

**实现要点**:
- 跟踪已完成数量
- 调用用户提供的进度回调
- 传递当前处理的图片信息

**代码生成提示**:
在downloadAll中维护completed计数器，每次下载完成后递增并调用progressCallback(completed, total, currentImage)。

---

## 任务3: 创建路径管理模块 (ImagePathManager)

### 任务描述
创建路径管理模块，负责文件命名、路径组织和Markdown引用更新。

### 输入
- Markdown文件名
- ImageInfo数组
- DownloadResult数组

### 输出
- `src/utils/imagePathManager.js` 文件

### 验收标准
- 生成规范的资源文件夹名称
- 生成唯一且安全的图片文件名
- 计算正确的相对路径
- 正确更新Markdown中的图片引用
- 清理文件名中的特殊字符

### 子任务

#### 3.1 创建ImagePathManager类
**描述**: 创建类文件并实现路径生成逻辑

**实现要点**:
```javascript
class ImagePathManager {
  constructor(markdownFilename) { ... }
  getAssetsFolderName() { ... }
  generateImageFilename(image, index) { ... }
  getRelativePath(imageFilename) { ... }
  sanitizeFilename(name) { ... }
}
```

**代码生成提示**:
创建 `src/utils/imagePathManager.js`，实现getAssetsFolderName返回`{markdownFilename}_assets`。实现sanitizeFilename移除特殊字符<>:"/\|?*，替换空格为下划线，限制长度200字符。

#### 3.2 实现Markdown引用更新
**描述**: 实现Markdown内容中图片引用路径的替换

**实现要点**:
- 匹配Markdown图片语法 `![alt](url)`
- 根据下载结果替换URL为本地路径
- 保留Alt文本不变
- 处理下载失败的图片（保留原URL）

**代码生成提示**:
实现updateMarkdownReferences方法，使用正则表达式`!\[([^\]]*)\]\(([^)]+)\)`匹配所有图片引用。遍历匹配结果，查找对应的DownloadResult，如果成功则替换为localPath，失败则保留原URL。

---

## 任务4: 扩展Markdown转换器

### 任务描述
扩展现有的MarkdownConverter类，添加图片处理能力。

### 输入
- 现有 `src/utils/converter.js` 文件

### 输出
- 修改后的 `src/utils/converter.js` 文件

### 验收标准
- 保持现有转换功能不变
- 添加图片提取集成
- 返回图片信息数组

### 子任务

#### 4.1 添加图片提取集成
**描述**: 在convert方法中集成ImageExtractor

**实现要点**:
- 引入ImageExtractor
- 在转换前提取图片信息
- 返回Markdown和图片信息

**代码生成提示**:
修改converter.js，在类顶部导入ImageExtractor。添加新方法convertWithImages，调用ImageExtractor.extract提取图片信息，返回{markdown, images}对象。保持原convert方法不变以保持向后兼容。

---

## 任务5: 扩展用户界面

### 任务描述
在popup界面添加图片处理选项和相关样式。

### 输入
- 现有 `src/popup/popup.html` 文件

### 输出
- 修改后的 `src/popup/popup.html` 文件
- 新增或修改的CSS样式

### 验收标准
- 添加"下载图片到本地"复选框
- 复选框默认选中
- 界面美观，与现有风格一致
- 添加提示文本说明功能

### 子任务

#### 5.1 添加图片选项UI元素
**描述**: 在popup.html中添加复选框和相关元素

**实现要点**:
```html
<div class="image-options">
  <label class="checkbox-label">
    <input type="checkbox" id="downloadImages" checked>
    <span>下载图片到本地</span>
  </label>
  <div class="option-hint">
    图片将保存在Markdown文件同级的资源文件夹中
  </div>
</div>
```

**代码生成提示**:
在popup.html的saveBtn按钮之前插入图片选项区域。添加checkbox input元素，id为downloadImages，默认checked。添加说明文本。

#### 5.2 添加CSS样式
**描述**: 为新增UI元素添加样式

**实现要点**:
- 设置选项区域背景和间距
- 美化复选框样式
- 设置提示文本样式

**代码生成提示**:
在popup.html的style标签中添加.image-options、.checkbox-label、.option-hint等样式类。使用与现有设计一致的配色方案（#f8f9fa背景，#202124文字颜色）。

---

## 任务6: 集成主控制逻辑

### 任务描述
修改popup.js主控制逻辑，集成图片下载流程。

### 输入
- 现有 `src/popup/popup.js` 文件
- 新创建的模块文件

### 输出
- 修改后的 `src/popup/popup.js` 文件

### 验收标准
- 读取用户选项（是否下载图片）
- 集成ImageExtractor、ImageDownloader、ImagePathManager
- 显示下载进度
- 正确处理错误和异常
- 保持现有功能不变

### 子任务

#### 6.1 导入新模块
**描述**: 在popup.js中导入新创建的模块

**实现要点**:
- 在HTML中添加script标签引入新模块
- 或使用ES6 import（如果配置了模块支持）

**代码生成提示**:
在popup.html的script标签区域，在popup.js之前添加imageExtractor.js、imageDownloader.js、imagePathManager.js的引用。

#### 6.2 修改保存按钮点击处理
**描述**: 重构saveBtn点击事件处理，添加图片下载流程

**实现要点**:
- 读取downloadImages复选框状态
- 如果启用，执行图片下载流程
- 显示进度信息
- 处理完成后保存Markdown

**代码生成提示**:
修改popup.js中saveBtn.addEventListener的回调函数。在提取页面内容后，检查downloadImages复选框。如果选中，调用ImageExtractor.extract提取图片，调用ImageDownloader.downloadAll下载图片，调用ImagePathManager.updateMarkdownReferences更新引用。显示进度信息。

#### 6.3 实现进度显示
**描述**: 实现下载进度和状态显示

**实现要点**:
- 显示当前下载进度（X/Y）
- 显示当前处理的图片URL
- 显示最终结果（成功/失败数量）

**代码生成提示**:
实现showProgress函数，接收ProgressState对象，更新statusDiv显示内容。在ImageDownloader.setProgressCallback中传入进度回调函数，实时更新UI。

#### 6.4 实现错误处理
**描述**: 添加完善的错误处理和用户提示

**实现要点**:
- 捕获各阶段异常
- 显示友好的错误消息
- 部分失败时显示详细统计

**代码生成提示**:
在主流程中使用try-catch包裹各阶段操作。捕获异常后调用showStatus('error', message)显示错误。统计成功和失败数量，显示汇总信息。

---

## 任务7: 添加用户设置持久化

### 任务描述
使用Chrome Storage API持久化用户设置。

### 输入
- 用户设置（是否下载图片）

### 输出
- 设置保存和读取功能

### 验收标准
- 使用chrome.storage.local保存设置
- 页面加载时恢复上次设置
- 提供默认值

### 子任务

#### 7.1 实现设置保存和加载
**描述**: 添加设置持久化逻辑

**实现要点**:
- 复选框变化时保存设置
- popup初始化时加载设置
- 使用默认值处理首次使用

**代码生成提示**:
在popup.js的init函数中，调用chrome.storage.local.get读取downloadImages设置，更新复选框状态。为复选框添加change事件监听，调用chrome.storage.local.set保存设置。

---

## 任务8: 测试和调试

### 任务描述
测试完整功能，修复发现的问题。

### 输入
- 完整实现代码

### 输出
- 测试报告
- Bug修复

### 验收标准
- 基本功能测试通过
- 错误场景测试通过
- 性能测试通过
- 无明显Bug

### 子任务

#### 8.1 功能测试
**描述**: 测试各种使用场景

**测试场景**:
- 包含多张图片的网页
- 包含Base64图片的网页
- 无图片的网页
- 部分图片URL无效的网页
- 跨域图片的网页

**代码生成提示**:
准备测试网页，包含各种图片类型。测试完整流程：打开popup，勾选下载图片选项，点击保存，验证Markdown文件和图片文件夹生成正确。

#### 8.2 错误场景测试
**描述**: 测试各种错误情况的处理

**测试场景**:
- 网络断开时的下载
- 超大图片（>10MB）
- 无效URL
- 磁盘空间不足（模拟）

**代码生成提示**:
使用Chrome DevTools模拟离线状态。测试各种错误场景，验证错误提示友好，不影响主流程。

#### 8.3 性能测试
**描述**: 测试大量图片的性能表现

**测试场景**:
- 包含50张图片的网页
- 测试并发下载效果
- 测试内存使用

**代码生成提示**:
创建包含大量图片的测试页面。使用Chrome DevTools Performance和Memory面板监控性能。验证并发控制有效，内存无泄漏。

---

## 任务依赖关系

```
任务1 (ImageExtractor)
    │
    ├──> 任务4 (扩展Converter)
    │
    └──> 任务6 (集成主逻辑)
             │
             └──> 任务8 (测试)

任务2 (ImageDownloader)
    │
    └──> 任务6 (集成主逻辑)

任务3 (ImagePathManager)
    │
    └──> 任务6 (集成主逻辑)

任务5 (扩展UI)
    │
    └──> 任务6 (集成主逻辑)

任务7 (设置持久化)
    │
    └──> 任务6 (集成主逻辑)
```

**建议执行顺序**:
1. 任务1 → 任务2 → 任务3 (并行开发核心模块)
2. 任务4 → 任务5 → 任务7 (扩展现有代码)
3. 任务6 (集成所有模块)
4. 任务8 (测试和修复)

---

## 风险和注意事项

### 技术风险
1. **Chrome API限制**: Chrome Downloads API可能有并发限制，需要测试实际并发能力
2. **跨域问题**: 部分图片可能有CORS限制，需要优雅降级
3. **大文件处理**: 超大图片可能导致内存问题，需要流式处理

### 兼容性风险
1. **Manifest V3限制**: Service Worker环境限制，部分API可能不可用
2. **浏览器差异**: 仅支持Chrome/Edge，不支持Firefox

### 性能风险
1. **大量图片**: 需要控制并发数避免浏览器限制
2. **网络状况**: 需要合理的超时和重试机制

---

## 验收检查清单

- [ ] ImageExtractor能正确提取各种格式的图片URL
- [ ] ImageDownloader能并发下载并正确处理错误
- [ ] ImagePathManager能生成正确的文件名和路径
- [ ] MarkdownConverter正确集成图片提取
- [ ] UI显示图片选项并能响应用户操作
- [ ] 主流程正确集成所有模块
- [ ] 进度显示准确及时
- [ ] 错误处理完善，用户提示友好
- [ ] 设置能正确持久化
- [ ] 所有测试场景通过
- [ ] 性能表现良好，无明显卡顿
- [ ] 不影响现有文字转换功能
