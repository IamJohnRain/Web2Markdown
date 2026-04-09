// 测试脚本 - 验证 Markdown 转换和图片下载功能
const https = require('https');
const fs = require('fs');
const path = require('path');

const testUrl = 'https://www.cnblogs.com/xing9/p/19793817';
const outputDir = 'D:\\Temp';

console.log('=== 开始测试 ===');
console.log('测试URL:', testUrl);
console.log('输出目录:', outputDir);

// 1. 获取网页内容
console.log('\n步骤1: 获取网页内容...');
https.get(testUrl, (res) => {
  let html = '';
  
  res.on('data', (chunk) => {
    html += chunk;
  });
  
  res.on('end', () => {
    console.log('网页内容获取成功,长度:', html.length);
    
    // 2. 提取标题
    console.log('\n步骤2: 提取标题...');
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'Untitled';
    console.log('标题:', title);
    
    // 3. 提取图片
    console.log('\n步骤3: 提取图片...');
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const images = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    console.log('找到图片数量:', images.length);
    images.forEach((img, i) => {
      console.log(`  图片${i+1}:`, img.substring(0, 80));
    });
    
    // 4. 保存测试结果
    console.log('\n步骤4: 保存测试结果...');
    const resultFile = path.join(outputDir, 'test-result.txt');
    const result = {
      url: testUrl,
      title: title,
      htmlLength: html.length,
      imageCount: images.length,
      images: images,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    console.log('测试结果已保存到:', resultFile);
    
    // 5. 检查目录
    console.log('\n步骤5: 检查输出目录...');
    const files = fs.readdirSync(outputDir);
    console.log('目录中的文件:', files);
    
    console.log('\n=== 测试完成 ===');
    console.log('\n注意: 这是一个基础测试脚本');
    console.log('实际的浏览器扩展功能需要在浏览器中测试');
    console.log('请手动测试浏览器扩展,将网页保存到 D:\\Temp 目录');
  });
}).on('error', (err) => {
  console.error('获取网页失败:', err.message);
});
