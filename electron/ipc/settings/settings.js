const { ipcMain } = require("electron");
const crypto = require("crypto");
const { getMasterDb } = require("../../../database/master/masterdb");

const { getSession } = require("../auth");

function registerSettingsHandlers() {
    ipcMain.handle("settings:getProfile", (event, userId) => {
        return getMasterDb()
            .prepare(
                `SELECT first_name, last_name, email, phone FROM users WHERE id = ?`
            )
            .get(userId);
    });

    ipcMain.handle(
        "settings:updateProfile",
        (event, { firstName, lastName, email, phone }) => {
            const session = getSession();
            getMasterDb()
                .prepare(
                    `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, updated_at = datetime('now') WHERE id = ? `
                )
                .run(firstName, lastName, email, phone || null, session.userId);

            // keep session in sync
            session.firstName = firstName;
            session.lastName = lastName;
            session.fullName = `${firstName} ${lastName}`.trim();
            return { success: true };
        }
    );

    ipcMain.handle(
        "settings:changePassword",
        async (event, { currentPassword, newPassword }) => {
            const session = getSession();
            const db = getMasterDb();
            const user = db
                .prepare(`SELECT salt, password_hash FROM users WHERE id=?`)
                .get(session.userId);

            const verifyHash = crypto
                .pbkdf2Sync(currentPassword, user.salt, 1000, 64, "sha512")
                .toString("hex");

            if (verifyHash !== user.password_hash) {
                return {
                    success: false,
                    message: "Current password is incorrect.",
                };
            }

            const newSalt = crypto.randomBytes(16).toString("hex");
            const newHash = crypto
                .pbkdf2Sync(newPassword, newSalt, 1000, 64, "sha512")
                .toString("hex");

            db.prepare(
                `UPDATE users SET salt=?, password_hash=? WHERE id=?`
            ).run(newSalt, newHash, session.userId);

            return { success: true };
        }
    );
}

module.exports = { registerSettingsHandlers };
