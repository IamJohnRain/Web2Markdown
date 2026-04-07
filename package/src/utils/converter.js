class MarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**'
    });
    
    this.configureRules();
  }
  
  configureRules() {
    this.turndownService.addRule('pre', {
      filter: 'pre',
      replacement: (content, node) => {
        const code = node.querySelector('code');
        let language = '';
        if (code) {
          const classes = code.className.split(' ');
          for (const cls of classes) {
            if (cls.startsWith('language-')) {
              language = cls.replace('language-', '');
              break;
            }
            if (cls.startsWith('hljs')) {
              continue;
            }
            language = cls;
          }
        }
        const codeContent = code ? code.textContent : node.textContent;
        return '\n```' + language + '\n' + codeContent.trim() + '\n```\n';
      }
    });
    
    this.turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: (content) => '~~' + content + '~~'
    });
    
    this.turndownService.addRule('taskList', {
      filter: (node) => {
        return node.nodeName === 'INPUT' && 
               node.type === 'checkbox' && 
               node.parentNode.nodeName === 'LI';
      },
      replacement: (content, node) => {
        return node.checked ? '[x] ' : '[ ] ';
      }
    });
    
    this.turndownService.addRule('table', {
      filter: 'table',
      replacement: (content, node) => {
        const rows = node.querySelectorAll('tr');
        if (rows.length === 0) return content;
        
        let result = '\n';
        const headerRow = rows[0];
        const headers = headerRow.querySelectorAll('th, td');
        const colCount = headers.length;
        
        result += '| ' + Array.from(headers).map(h => h.textContent.trim()).join(' | ') + ' |\n';
        result += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
        
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td, th');
          result += '| ' + Array.from(cells).map(c => c.textContent.trim()).join(' | ') + ' |\n';
        }
        
        return result + '\n';
      }
    });
    
    this.turndownService.addRule('removeEmpty', {
      filter: (node) => {
        return (node.nodeName === 'DIV' || node.nodeName === 'SPAN' || node.nodeName === 'P') && 
               !node.textContent.trim() && 
               !node.querySelector('img');
      },
      replacement: () => ''
    });
  }
  
  convert(html, title, url) {
    let markdown = '';
    
    if (title) {
      markdown += '# ' + title + '\n\n';
    }
    
    if (url) {
      markdown += '> 来源: ' + url + '\n\n';
      markdown += '---\n\n';
    }
    
    markdown += this.turndownService.turndown(html);
    
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim() + '\n';
    
    return markdown;
  }
  
  sanitizeFileName(name) {
    let sanitized = name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
    
    return sanitized.substring(0, 200) || 'untitled';
  }
}
