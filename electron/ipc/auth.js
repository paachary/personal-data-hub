const { ipcMain } = require("electron");
const crypto = require("crypto");
const keytar = require("keytar");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

const { getMasterDb } = require("../../database/master/masterdb");
const { initFinanceDb } = require("../../database/finance/financeDb");

const { initVault, closeVault } = require("../vault/vaultDb");

const SERVICE_NAME = "MyMultiUserVault";

const session = {
    userId: null,
    username: null,
    vaultKey: null,
    firstName: null,
    lastName: null,
    fullName: null,
    isAdmin: false,
};

function getSession() {
    return session;
}

function clearSession() {
    session.userId = null;
    session.username = null;
    session.vaultKey = null;
    session.firstName = null;
    session.lastName = null;
    session.fullName = null;
    session.isAdmin = false;
    closeVault();
}

function registerAuthHandlers() {
    ipcMain.handle(
        "auth:register",
        async (
            event,
            {
                firstName,
                lastName,
                username,
                email,
                phone,
                address,
                password,
                isAdmin,
            }
        ) => {
            const db = getMasterDb();

            const salt = crypto.randomBytes(16).toString("hex");
            const hash = crypto
                .pbkdf2Sync(password, salt, 1000, 64, "sha512")
                .toString("hex");

            const vaultEncryptionKey = crypto.randomBytes(32).toString("hex");

            try {
                const insert = db.prepare(`
                    INSERT INTO users 
                    (first_name, last_name, username, email, phone, address_line1, address_line2, city, state, zip, country, salt, password_hash, vault_path, is_admin)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                `);
                insert.run(
                    firstName,
                    lastName,
                    username,
                    email,
                    phone || "",
                    address.line1,
                    address.line2 ?? "",
                    address.city,
                    address.state,
                    address.zip,
                    address.country,
                    salt,
                    hash,
                    `vault_${username}.json`,
                    isAdmin ? 1 : 0
                );

                await keytar.setPassword(
                    SERVICE_NAME,
                    username,
                    vaultEncryptionKey
                );

                return { success: true };
            } catch (e) {
                console.error("Registration error:", e.message);
                return { success: false, message: e.message };
            }
        }
    );

    ipcMain.handle("auth:login", async (event, { username, password }) => {
        const db = getMasterDb();
        const user = db
            .prepare("SELECT * FROM users WHERE username = ?")
            .get(username);

        if (!user)
            return {
                success: false,
                message: "Invalid credentails! Please resubmit!",
            };

        const verifyHash = crypto
            .pbkdf2Sync(password, user.salt, 1000, 64, "sha512")
            .toString("hex");

        if (verifyHash === user.password_hash) {
            const vaultKey = await keytar.getPassword(SERVICE_NAME, username);

            session.userId = user.id;
            session.username = username;
            session.vaultKey = vaultKey;
            session.firstName = user.first_name;
            session.lastName = user.last_name;
            session.fullName = `${user.first_name} ${user.last_name}`;
            session.isAdmin = user.is_admin === 1;

            initVault(username, vaultKey);
            await initFinanceDb();

            return {
                success: true,
                username,
                requiresPasswordReset: user.requires_password_reset === 1, // ← add
                requiresMfa: user.mfa_enabled === 1, // ← add
                mfaSetupRequired: user.mfa_enabled === 0, // ← new user, must setup
            };
        }

        return {
            success: false,
            message: "Invalid credentails! Please resubmit!",
        };
    });

    ipcMain.handle("auth:logout", () => {
        clearSession();
        return { success: true };
    });

    ipcMain.handle("auth:session", () => {
        // Only expose safe info to renderer, never the vaultKey
        return {
            isLoggedIn: !!session.username,
            userId: session.userId,
            username: session.username,
            fullName: session.fullName,
            isAdmin: session.isAdmin,
        };
    });
    // ── MFA: generate secret + QR for setup ──────────────
    ipcMain.handle("auth:mfa:setup", async () => {
        if (!session.userId) throw new Error("Not logged in");

        const secret = speakeasy.generateSecret({
            name: `PersonalData (${session.username})`,
            length: 20,
        });

        // store secret temporarily (not yet confirmed)
        const db = getMasterDb();
        db.prepare(`UPDATE users SET mfa_secret = ? WHERE id = ?`).run(
            secret.base32,
            session.userId
        );

        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32, // for manual entry
            qr: qrDataUrl, // base64 QR image
        };
    });

    // ── MFA: verify token during setup ───────────────────
    ipcMain.handle("auth:mfa:verify-setup", (event, { token }) => {
        if (!session.userId) throw new Error("Not logged in");

        const db = getMasterDb();
        const user = db
            .prepare(`SELECT mfa_secret FROM users WHERE id = ?`)
            .get(session.userId);

        const valid = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: "base32",
            token,
            window: 1,
        });

        if (!valid)
            return {
                success: false,
                message: "Invalid code. Please try again.",
            };

        db.prepare(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`).run(
            session.userId
        );
        return { success: true };
    });

    // ── MFA: verify token during login ───────────────────
    ipcMain.handle("auth:mfa:verify-login", (event, { token }) => {
        if (!session.userId) throw new Error("Not logged in");

        const db = getMasterDb();
        const user = db
            .prepare(`SELECT mfa_secret FROM users WHERE id = ?`)
            .get(session.userId);

        const valid = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: "base32",
            token,
            window: 1,
        });

        if (!valid)
            return {
                success: false,
                message: "Invalid code. Please try again.",
            };
        return { success: true };
    });

    // ── MFA: admin reset MFA for a user ──────────────────
    ipcMain.handle("auth:mfa:reset", (event, { userId }) => {
        if (!session.isAdmin) throw new Error("Unauthorized");

        const db = getMasterDb();
        db.prepare(
            `UPDATE users SET mfa_secret = NULL, mfa_enabled = 0 WHERE id = ?`
        ).run(userId);
        return { success: true };
    });
}

module.exports = { registerAuthHandlers, getSession };
