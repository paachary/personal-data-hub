const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getDbDir } = require("../../database/dbPath");

const ALGORITHM = "aes-256-gcm";

let dbPath = null;
let currentVaultKey = null;

// ── Read / Write ──────────────────────────────────────────

function readDb() {
    if (!dbPath) throw new Error("Vault not initialised");
    const raw = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(raw);
}

function writeDb(data) {
    if (!dbPath) throw new Error("Vault not initialised");
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

// ── Init / Close ──────────────────────────────────────────

function initVault(username, vaultKey) {
    dbPath = path.join(getDbDir(), `vault_${username}.json`);
    currentVaultKey = vaultKey;

    if (!fs.existsSync(dbPath)) {
        writeDb({ entries: [], notes: [] });
    }
}

function closeVault() {
    dbPath = null;
    currentVaultKey = null;
}

// ── Crypto ────────────────────────────────────────────────

function encrypt(text, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(key, "hex"),
        iv
    );
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(data, key) {
    const [ivHex, authTagHex, encrypted] = data.split(":");
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(key, "hex"),
        Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ── Collection helpers (mimics lowdb API used in vault.js) ──

function getDb() {
    if (!dbPath) return null;
    return {
        read: readDb,
        write: writeDb,
    };
}

function getVaultKey() {
    return currentVaultKey;
}

// ── Direct collection accessors used by vault.js ─────────

function getEntries() {
    return readDb().entries;
}
function getNotes() {
    return readDb().notes;
}

function saveEntries(entries) {
    const db = readDb();
    db.entries = entries;
    writeDb(db);
}

function saveNotes(notes) {
    const db = readDb();
    db.notes = notes;
    writeDb(db);
}

module.exports = {
    initVault,
    closeVault,
    encrypt,
    decrypt,
    getDb,
    getVaultKey,
    getEntries,
    getNotes,
    saveEntries,
    saveNotes,
};
