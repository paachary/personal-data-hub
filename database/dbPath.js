const { app } = require("electron");
const path = require("path");
const fs = require("fs");

function getDbDir() {
    const dbDir = path.join(app.getPath("userData"), "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    return dbDir;
}

module.exports = { getDbDir };
