//npm init -y
//npm install electron --save-dev


const electron = require('electron');
const app = electron.app;
const ejs = require('ejs-electron');
//npm install ejs-electron --save-dev

ejs.data({
    'title': "Sheets",
    'rows': 100,
    'cols': 26
});

function createWindow() {
    const win = new electron.BrowserWindow({
        width: 800,
        height: 600,
        show: false,                //to open app in hidden mode
        
        webPreferences: {
            nodeIntegration: true
        },

        transparent: true,
    });

    win.loadFile("index.ejs").then(function() {
        //to remove default menu
        win.removeMenu();

        //maximize
        win.maximize();

        //unhide app so that user could view it
        win.show();

        //to open dev tools
        win.webContents.openDevTools();
    });
}

app.whenReady().then(createWindow);


// syntax (for closing in mac)
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})
app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.
