function extractPageContent() {
  const title = document.title;
  
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content'
  ];
  
  let content = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText && el.innerText.length > 100) {
      content = el;
      break;
    }
  }
  
  if (!content) {
    content = document.body;
  }
  
  const clone = content.cloneNode(true);
  
  const removeSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.ads',
    '.advertisement',
    '.social-share',
    '.comments',
    '.related-posts',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="complementary"]'
  ];
  
  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  return {
    title: title,
    html: clone.innerHTML,
    url: window.location.href
  };
}

extractPageContent();
