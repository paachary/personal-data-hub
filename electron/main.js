// electron/main.js
const { BrowserWindow, app, protocol, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { registerAllHandlers } = require("./ipc/index");
const {
    startReminderScheduler,
    stopReminderScheduler,
} = require("./ipc/todos/todos");

const { closeFinanceDb } = require("../database/finance/financeDb");
const { getHelpContent } = require("./help");

function openHelpWindow(page = "dashboard") {
    const helpWin = new BrowserWindow({
        width: 800,
        height: 600,
        title: "Help",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const content = getHelpContent(page);

    helpWin.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: sans-serif; padding: 2rem; background: #0f172a; color: #e2e8f0; }
                h1,h2,h3 { color: #60a5fa; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1px solid #334155; padding: 0.5rem 1rem; }
                th { background: #1e293b; }
                code { background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; }
                pre { background: #1e293b; padding: 1rem; border-radius: 8px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <pre>${content}</pre>
        </body>
        </html>
    `)}`
    );
}

const isDev = process.env.NODE_ENV === "development";
let currentSection = "dashboard"; // ← track active section

function setCurrentSection(section) {
    currentSection = section;
}

module.exports = { setCurrentSection };

let mainWindow;

function createMenu() {
    const isMac = process.platform === "darwin";
    const template = [
        // ...existing code...
        {
            label: "Help",
            submenu: [
                {
                    label: "📖 Documentation & Help",
                    click: () => openHelpWindow(currentSection), // ← use tracked section
                },
                { type: "separator" },
                { label: `Version ${app.getVersion()}`, enabled: false },
            ],
        },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Register protocol BEFORE app is ready
protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: false,
        },
    },
]);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: "#0f172a",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:4000");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadURL("app://./index.html"); // ← Load login page directly
        // mainWindow.webContents.openDevTools(); // ← Uncomment to debug
    }

    mainWindow.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription, validatedURL) => {
            console.error(
                "Failed to load:",
                errorCode,
                errorDescription,
                validatedURL
            );
        }
    );
}

app.whenReady().then(() => {
    protocol.handle("app", (request) => {
        const url = request.url.slice("app://".length);

        // Ignore RSC requests (_rsc, __nextDataReq, etc.)
        if (url.includes("_rsc=") || url.includes("__nextDataReq")) {
            return new Response(null, { status: 204 }); // ← 204 No Content (silent)
        }

        const filePath = path.normalize(path.join(__dirname, "..", "out", url));
        const outDir = path.normalize(path.join(__dirname, "..", "out"));

        // Security check
        if (!filePath.startsWith(outDir)) {
            console.error("Security: blocked path", filePath);
            return new Response("Forbidden", { status: 403 });
        }

        // Determine target file
        let targetPath = filePath;

        // If no extension, look for index.html
        if (!path.extname(filePath) || filePath.endsWith("/")) {
            const indexPath = path.join(filePath, "index.html");
            if (fs.existsSync(indexPath)) {
                targetPath = indexPath;
            } else {
                // Fallback to root index.html for SPA routing
                targetPath = path.join(outDir, "index.html");
            }
        }

        try {
            const data = fs.readFileSync(targetPath);
            const ext = path.extname(targetPath);
            const mimeTypes = {
                ".html": "text/html",
                ".js": "text/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
                ".txt": "text/plain",
            };

            return new Response(data, {
                headers: {
                    "Content-Type":
                        mimeTypes[ext] || "application/octet-stream",
                },
            });
        } catch (err) {
            console.error("Failed to read file:", targetPath, err);
            return new Response("Not Found", { status: 404 });
        }
    });

    createMenu();
    registerAllHandlers();
    createWindow();
    startReminderScheduler();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    closeFinanceDb();
    if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
    stopReminderScheduler(); // ← Clean up on quit
});
