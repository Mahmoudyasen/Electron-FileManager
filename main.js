const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers with robust error handling
ipcMain.handle('read-dir', (_, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return [];
    
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    return files.map(dirent => {
      try {
        const fullPath = path.join(dirPath, dirent.name);
        const stats = fs.statSync(fullPath);
        return {
          name: dirent.name,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.isFile() ? stats.size : 0,
          modified: stats.mtime
        };
      } catch (error) {
        // Skip files with permission errors
        return {
          name: dirent.name,
          path: path.join(dirPath, dirent.name),
          isDirectory: false,
          isFile: false,
          size: 0,
          modified: new Date(),
          error: true
        };
      }
    }).filter(item => item); // Remove null entries
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
    return [];
  }
});

ipcMain.handle('get-drives', () => {
  if (process.platform === 'win32') {
    const drives = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    for (let i = 0; i < letters.length; i++) {
      const drive = `${letters[i]}:\\`;
      try {
        // Check drive accessibility
        fs.accessSync(drive, fs.constants.R_OK);
        drives.push(drive);
      } catch (error) {
        // Skip inaccessible drives
      }
    }
    return drives;
  } else {
    // Linux/macOS
    return ['/'];
  }
});

ipcMain.handle('open-item', (_, itemPath) => {
  shell.openPath(itemPath).catch(err => {
    console.error('Error opening item:', err);
  });
});

ipcMain.handle('delete-item', async (_, itemPath) => {
  try {
    if (!fs.existsSync(itemPath)) return false;
    
    if (fs.lstatSync(itemPath).isDirectory()) {
      fs.rmdirSync(itemPath, { recursive: true });
    } else {
      fs.unlinkSync(itemPath);
    }
    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
});

ipcMain.handle('create-folder', (_, parentPath, folderName) => {
  try {
    const newPath = path.join(parentPath, folderName);
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath);
      return newPath;
    }
    return null;
  } catch (error) {
    console.error('Create folder error:', error);
    return null;
  }
});

ipcMain.handle('get-home-dir', () => {
  return os.homedir();
});

ipcMain.handle('show-error-dialog', (_, message) => {
  dialog.showErrorBox('File Manager Error', message);
});