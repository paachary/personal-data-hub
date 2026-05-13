const { ipcMain } = require("electron");
const crypto = require("crypto");
const { getMasterDb } = require("../../../database/master/masterdb");
const { getSession } = require("../auth");

function registerAdminUserHandlers() {
    // Get all users
    ipcMain.handle("admin:users:getAll", () => {
        const session = getSession();
        if (!session.isAdmin) throw new Error("Unauthorized");

        const db = getMasterDb();
        return db
            .prepare(
                `
            SELECT
                id, first_name, last_name, username, email,
                address_line1, address_line2, city, state, zip, country,
                is_admin, requires_password_reset, created_at
            FROM users
            ORDER BY first_name, last_name
        `
            )
            .all();
    });

    // Admin reset password for a user
    ipcMain.handle(
        "admin:users:resetPassword",
        (event, { userId, tempPassword }) => {
            const session = getSession();
            if (!session.isAdmin) throw new Error("Unauthorized");

            const db = getMasterDb();
            const salt = crypto.randomBytes(16).toString("hex");
            const hash = crypto
                .pbkdf2Sync(tempPassword, salt, 1000, 64, "sha512")
                .toString("hex");

            db.prepare(
                `
            UPDATE users
            SET password_hash = ?, salt = ?, requires_password_reset = 1, updated_at = datetime('now')
            WHERE id = ?
        `
            ).run(hash, salt, userId);

            return { success: true };
        }
    );

    // User changes their own password (after forced reset)
    ipcMain.handle("admin:users:changePassword", (event, { newPassword }) => {
        const session = getSession();
        if (!session.userId) throw new Error("Not logged in");

        const db = getMasterDb();
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto
            .pbkdf2Sync(newPassword, salt, 1000, 64, "sha512")
            .toString("hex");

        db.prepare(
            `
            UPDATE users
            SET password_hash = ?, salt = ?, requires_password_reset = 0, updated_at = datetime('now')
            WHERE id = ?
        `
        ).run(hash, salt, session.userId);

        return { success: true };
    });
}

module.exports = { registerAdminUserHandlers };
