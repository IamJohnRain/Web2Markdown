# Web to Markdown Chrome 插件

## 项目概述

一个 Chrome 浏览器插件，将当前网页转换为 Markdown 格式，保存到用户指定的本地磁盘位置，保存成功后将文件绝对路径复制到剪贴板并弹出提示。

## 功能需求

### 核心功能

1. **网页转 Markdown**
   - 提取网页标题作为文件名
   - 将网页内容转换为标准 Markdown 格式
   - 保留基本格式：标题、段落、列表、链接、图片、代码块、表格等

2. **本地存储**
   - 支持用户选择磁盘存储位置
   - 自动以网页标题命名文件（去除非法字符）
   - 文件扩展名为 `.md`

3. **剪贴板操作**
   - 保存成功后自动将文件绝对路径复制到剪贴板
   - 弹出成功提示，显示保存路径

### 用户交互流程

```
用户点击插件图标 
    → 插件提取当前页面内容 
    → 转换为 Markdown 
    → 弹出文件保存对话框 
    → 用户选择保存位置 
    → 文件保存到本地 
    → 路径复制到剪贴板 
    → 显示成功提示
```

## 技术方案

### 技术栈

- **前端框架**: Vanilla JavaScript / TypeScript
- **Markdown 转换**: [Turndown.js](https://github.com/mixmark-io/turndown)
- **文件系统 API**: File System Access API
- **构建工具**: Webpack / Vite

### 项目结构

```
mdPlugin/
├── manifest.json          # Chrome 插件配置文件
├── src/
│   ├── background.js      # Service Worker 后台脚本
│   ├── content.js         # 内容脚本，提取页面内容
│   ├── popup/
│   │   ├── popup.html     # 弹出窗口 UI
│   │   ├── popup.js       # 弹出窗口逻辑
│   │   └── popup.css      # 弹出窗口样式
│   └── utils/
│       ├── converter.js   # Markdown 转换逻辑
│       └── fileSaver.js   # 文件保存逻辑
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/
│   └── turndown.min.js    # Markdown 转换库
└── README.md
```

### 核心模块设计

#### 1. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Web to Markdown",
  "version": "1.0.0",
  "description": "将网页转换为 Markdown 并保存到本地",
  "permissions": [
    "activeTab",
    "clipboardWrite",
    "scripting",
    "downloads"
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "src/background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### 2. 内容脚本 (content.js)

负责提取当前页面的 DOM 内容。

```javascript
// 提取页面主要内容
function extractPageContent() {
  const title = document.title;
  
  // 优先提取 article 或 main 标签
  let content = document.querySelector('article') || 
                document.querySelector('main') || 
                document.body;
  
  return {
    title: title,
    html: content.innerHTML
  };
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const content = extractPageContent();
    sendResponse(content);
  }
});
```

#### 3. Markdown 转换器 (converter.js)

使用 Turndown.js 将 HTML 转换为 Markdown。

```javascript
class MarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });
    
    // 自定义规则
    this.configureRules();
  }
  
  configureRules() {
    // 处理代码块
    this.turndownService.addRule('codeBlock', {
      filter: 'pre',
      replacement: (content, node) => {
        const code = node.querySelector('code');
        const language = code?.className?.replace('language-', '') || '';
        return '\n```' + language + '\n' + content + '\n```\n';
      }
    });
    
    // 处理图片
    this.turndownService.addRule('image', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.alt || '';
        const src = node.src || '';
        return `![${alt}](${src})`;
      }
    });
  }
  
  convert(html) {
    return this.turndownService.turndown(html);
  }
  
  // 清理文件名中的非法字符
  sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
  }
}
```

#### 4. 文件保存模块 (fileSaver.js)

使用 File System Access API 实现文件保存。

```javascript
class FileSaver {
  async saveFile(content, defaultName) {
    try {
      // 显示文件保存对话框
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName + '.md',
        types: [{
          description: 'Markdown Files',
          accept: { 'text/markdown': ['.md'] }
        }]
      });
      
      // 写入文件
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return {
        success: true,
        path: handle.name
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, reason: 'cancelled' };
      }
      return { success: false, reason: error.message };
    }
  }
  
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  }
}
```

#### 5. 弹出窗口 (popup.js)

主控制逻辑，协调各模块工作。

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  
  saveBtn.addEventListener('click', async () => {
    try {
      // 1. 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 2. 注入内容脚本并提取内容
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent
      });
      
      const { title, html } = results[0].result;
      
      // 3. 转换为 Markdown
      const converter = new MarkdownConverter();
      const markdown = converter.convert(html);
      const fileName = converter.sanitizeFileName(title);
      
      // 4. 保存文件
      const fileSaver = new FileSaver();
      const result = await fileSaver.saveFile(markdown, fileName);
      
      if (result.success) {
        // 5. 复制路径到剪贴板
        await fileSaver.copyToClipboard(result.path);
        
        // 6. 显示成功提示
        showStatus('success', `保存成功！路径已复制: ${result.path}`);
      } else if (result.reason !== 'cancelled') {
        showStatus('error', `保存失败: ${result.reason}`);
      }
      
    } catch (error) {
      showStatus('error', `发生错误: ${error.message}`);
    }
  });
});

function showStatus(type, message) {
  const statusDiv = document.getElementById('status');
  statusDiv.className = `status ${type}`;
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
}

function extractPageContent() {
  const title = document.title;
  let content = document.querySelector('article') || 
                document.querySelector('main') || 
                document.body;
  return { title, html: content.innerHTML };
}
```

#### 6. 弹出窗口 UI (popup.html)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 320px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    h1 {
      font-size: 16px;
      margin: 0 0 12px 0;
      color: #333;
    }
    
    #saveBtn {
      width: 100%;
      padding: 10px;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    #saveBtn:hover {
      background: #3367d6;
    }
    
    .status {
      margin-top: 12px;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      display: none;
    }
    
    .status.success {
      background: #e6f4ea;
      color: #137333;
      border: 1px solid #137333;
    }
    
    .status.error {
      background: #fce8e6;
      color: #c5221f;
      border: 1px solid #c5221f;
    }
  </style>
</head>
<body>
  <h1>Web to Markdown</h1>
  <button id="saveBtn">保存为 Markdown</button>
  <div id="status"></div>
  <script src="../lib/turndown.min.js"></script>
  <script src="../utils/converter.js"></script>
  <script src="../utils/fileSaver.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

## 开发计划

### 第一阶段：基础功能开发

| 任务 | 预计时间 | 说明 |
|------|----------|------|
| 项目初始化 | 0.5 天 | 创建项目结构，配置 manifest.json |
| 内容提取模块 | 1 天 | 实现页面内容提取逻辑 |
| Markdown 转换 | 1 天 | 集成 Turndown.js，处理各种 HTML 元素 |
| 文件保存功能 | 1 天 | 实现 File System Access API 保存逻辑 |
| UI 开发 | 0.5 天 | 开发弹出窗口界面 |
| 剪贴板功能 | 0.5 天 | 实现路径复制和提示功能 |

### 第二阶段：优化与测试

| 任务 | 预计时间 | 说明 |
|------|----------|------|
| 兼容性测试 | 1 天 | 测试不同网站的转换效果 |
| 错误处理 | 0.5 天 | 完善异常处理和用户提示 |
| 性能优化 | 0.5 天 | 优化大页面转换性能 |

### 第三阶段：发布

| 任务 | 预计时间 | 说明 |
|------|----------|------|
| 打包构建 | 0.5 天 | 配置构建流程，生成发布包 |
| 文档完善 | 0.5 天 | 完善用户使用文档 |

## 安装与使用

### 开发环境安装

1. 克隆项目
```bash
git clone <repository-url>
cd mdPlugin
```

2. 安装依赖（如需要）
```bash
npm install
```

3. 在 Chrome 中加载插件
   - 打开 Chrome，访问 `chrome://extensions/`
   - 开启「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择项目根目录

### 使用方法

1. 浏览到任意网页
2. 点击浏览器工具栏中的插件图标
3. 在弹出窗口中点击「保存为 Markdown」按钮
4. 选择保存位置和文件名
5. 保存成功后，文件路径自动复制到剪贴板

## 注意事项

### 浏览器兼容性

- File System Access API 需要 Chrome 86+ 版本
- 部分网站可能有内容安全策略限制

### 已知限制

- 动态加载的内容可能无法完全捕获
- 某些复杂布局可能转换效果不佳
- 跨域图片可能无法正常显示

## 后续优化方向

1. **内容智能提取**：使用 Readability 算法提取正文内容
2. **自定义模板**：支持用户自定义 Markdown 输出格式
3. **批量保存**：支持批量保存多个标签页
4. **云同步**：支持保存到云存储服务
5. **历史记录**：记录保存历史，方便管理

## 许可证

MIT License
