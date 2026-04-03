class FileSaver {
  async saveFile(content, defaultName) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName + '.md',
        types: [{
          description: 'Markdown Files',
          accept: { 'text/markdown': ['.md'] }
        }]
      });
      
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return {
        success: true,
        name: handle.name
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
      console.error('Copy failed:', error);
      return false;
    }
  }
}
