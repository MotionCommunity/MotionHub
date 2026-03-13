const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('motionHub', {
  openExternal: (url) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      shell.openExternal(url);
    }
  },
});

