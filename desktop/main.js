// Bader Wallstudio – Windows-Programm
// Eine schlanke Hülle: eigenes Fenster und Symbol, der Inhalt kommt von der bestehenden Web-App.
// Projekte und Einstellungen liegen im Benutzerprofil und bleiben bei Updates erhalten.
const { app, BrowserWindow, shell, Menu, session } = require('electron');

const START = 'https://baderdesign.github.io/wandstudio/';
const HOME = 'https://baderdesign.github.io/wandstudio';
const inApp = url => url === HOME || url.startsWith(HOME + '/') || url.startsWith(HOME + '?') || url.startsWith(HOME + '#');

const OFFLINE = 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html lang="de"><meta charset="utf-8">
<title>Bader Wallstudio</title>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f3ee;color:#22211f;font:16px/1.5 Segoe UI,system-ui,sans-serif">
<div style="max-width:420px;text-align:center;padding:24px">
<h1 style="font-size:22px;letter-spacing:.06em">BADER WALLSTUDIO</h1>
<p>Keine Verbindung zum Internet. Beim ersten Start braucht das Programm einmal Internet, danach läuft es auch ohne.</p>
<p><a href="${START}" style="display:inline-block;background:#a8875a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:600">Erneut versuchen</a></p>
</div></body></html>`);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'Bader Wallstudio', backgroundColor: '#f5f3ee', autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', e => e.preventDefault());
  win.on('closed', () => { win = null; });

  const wc = win.webContents;
  // Nur die eigene App darf im Fenster laufen; andere Adressen öffnen im normalen Browser.
  wc.on('will-navigate', (e, url) => {
    if (inApp(url) || url.startsWith('data:text/html')) return;
    e.preventDefault();
    if (url.startsWith('https://')) shell.openExternal(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (inApp(url)) return { action: 'allow' };
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Ohne Internet und ohne gespeicherte App: Hinweisseite statt leerem Fenster.
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !String(url).startsWith('data:')) wc.loadURL(OFFLINE);
  });
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F5') { wc.loadURL(START); e.preventDefault(); }
  });
  wc.loadURL(START);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
      cb(['clipboard-sanitized-write', 'fullscreen'].includes(permission));
    });
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
