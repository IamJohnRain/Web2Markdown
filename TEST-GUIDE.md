# Web2Markdown 测试指南

## 测试目标
验证将网页 https://www.cnblogs.com/xing9/p/19793817 转换为 Markdown 并保存到 D:\Temp 目录

## 当前限制说明

由于 Chrome Downloads API 的安全限制:
- **MD 文件**: 可以保存到用户选择的任意目录 (如 D:\Temp)
- **图片**: 只能保存到默认下载目录的 `images` 子目录

## 手动测试步骤

### 1. 加载扩展
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 Web2Markdown 项目目录

### 2. 执行转换
1. 访问 https://www.cnblogs.com/xing9/p/19793817
2. 点击浏览器扩展图标
3. 勾选"下载图片"选项
4. 点击"保存为 Markdown"按钮
5. 在弹出的保存对话框中,选择 D:\Temp 目录
6. 文件名设置为: `手撕_Transformer_5_模型构建.md`

### 3. 检查结果

#### 预期结果:
- **MD 文件位置**: `D:\Temp\手撕_Transformer_5_模型构建.md`
- **图片位置**: `C:\Users\{用户名}\Downloads\images\` (默认下载目录)
- **图片数量**: 2张实际内容图片 (其他为网站图标)

#### 需要手动操作:
1. 找到默认下载目录中的 `images` 文件夹
2. 将 `images` 文件夹移动到 `D:\Temp\` 目录
3. 现在 MD 文件和图片在同一目录下,可以正常显示

### 4. 验证 Markdown 内容

打开生成的 MD 文件,检查:
- [ ] 标题正确
- [ ] 内容格式正确
- [ ] 图片引用使用相对路径: `images/xxx.png`
- [ ] 图片可以正常显示 (移动 images 文件夹后)

## 已知问题

1. **图片路径问题**: 由于 Chrome API 限制,图片无法直接保存到用户指定目录
2. **解决方案**: 
   - 当前: 提示用户手动移动图片目录
   - 未来: 考虑使用 File System Access API

## 测试结果记录

请在测试后记录以下信息:

### 测试时间:
- 

### 测试结果:
- [ ] MD 文件成功保存到 D:\Temp
- [ ] 图片成功下载到默认下载目录
- [ ] 图片数量正确
- [ ] Markdown 内容格式正确
- [ ] 移动图片目录后可以正常显示

### 发现的问题:
- 

### 错误信息 (如有):
- 

## 自动化测试

已创建基础测试脚本 `test-conversion.js`,可以验证:
- 网页内容获取
- 标题提取
- 图片提取

运行方式:
```bash
node test-conversion.js
```

测试结果保存在: `D:\Temp\test-result.txt`
