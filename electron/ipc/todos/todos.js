const { ipcMain, Notification, app } = require("electron");
const { getMasterDb } = require("../../../database/master/masterdb");
const { getSession } = require("../auth");
const { v4: uuidv4 } = require("uuid");

// ── Reminder Scheduler ────────────────────────────────────

let reminderTimer = null;

function startReminderScheduler() {
    // Check every minute
    reminderTimer = setInterval(() => {
        checkAndFireReminders();
    }, 60 * 1000);

    // Also check immediately on start
    checkAndFireReminders();
}

function stopReminderScheduler() {
    if (reminderTimer) {
        clearInterval(reminderTimer);
        reminderTimer = null;
    }
}

function checkAndFireReminders() {
    try {
        const db = getMasterDb();
        const now = new Date().toISOString();

        const due = db
            .prepare(
                `SELECT * FROM todos
                 WHERE status = 'pending'
                   AND reminded = 0
                   AND remind_at IS NOT NULL
                   AND remind_at <= ?`
            )
            .all(now);

        for (const todo of due) {
            fireNotification(todo);
            db.prepare(`UPDATE todos SET reminded = 1 WHERE id = ?`).run(
                todo.id
            );
        }
    } catch (e) {
        console.error("[Reminder]", e.message);
    }
}

function fireNotification(todo) {
    if (!Notification.isSupported()) return;

    const priority =
        {
            high: "🔴",
            medium: "🟡",
            low: "🟢",
        }[todo.priority] ?? "🔔";

    new Notification({
        title: `${priority}  Personal Data Reminder`,
        body: todo.title + (todo.notes ? `\n${todo.notes}` : ""),
        silent: false,
    }).show();
}

// ── Auto-generate todos from vault entries with expiry ────

function generateVaultReminders(entries) {
    try {
        const db = getMasterDb();

        for (const entry of entries) {
            const data = entry.data;

            // Check for expiry date fields
            const expiryFields = ["expiryDate", "issueDate"];
            for (const field of expiryFields) {
                if (!data[field]) continue;

                const expiryDate = new Date(data[field]);
                if (isNaN(expiryDate)) continue;

                // Only create reminder if expiry is in future
                if (expiryDate < new Date()) continue;

                // Check if reminder already exists for this vault entry
                const existing = db
                    .prepare(
                        `SELECT id FROM todos WHERE source_ref = ? AND source = 'vault'`
                    )
                    .get(entry.id);

                if (existing) continue;

                // Remind 30 days before expiry
                const remindAt = new Date(expiryDate);
                remindAt.setDate(remindAt.getDate() - 30);

                const label =
                    data.passportNumber ||
                    data.aadhaarNumber ||
                    data.label ||
                    entry.type;

                db.prepare(
                    `INSERT INTO todos (id, title, notes, priority, due_date, remind_at, source, source_ref)
                     VALUES (?, ?, ?, 'high', ?, ?, 'vault', ?)`
                ).run(
                    uuidv4(),
                    `${
                        entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
                    }: ${label} — expiring soon`,
                    `${
                        field === "expiryDate" ? "Expires" : "Issued"
                    }: ${expiryDate.toLocaleDateString("en-GB")}`,
                    expiryDate.toISOString().slice(0, 10),
                    remindAt.toISOString(),
                    entry.id
                );
            }
        }
    } catch (e) {
        console.error("[VaultReminders]", e.message);
    }
}

// ── IPC Handlers ──────────────────────────────────────────

function registerTodoHandlers() {
    ipcMain.handle("todos:getAll", () => {
        try {
            const db = getMasterDb();
            const todos = db
                .prepare(
                    `SELECT * FROM todos ORDER BY
                    CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                    due_date ASC NULLS LAST,
                    created_at DESC`
                )
                .all();
            return { success: true, todos };
        } catch (e) {
            console.error("[todos:getAll]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle(
        "todos:add",
        (event, { title, notes, priority, dueDate, remindAt }) => {
            try {
                const db = getMasterDb();
                const id = uuidv4();
                db.prepare(
                    `INSERT INTO todos (id, title, notes, priority, due_date, remind_at)
                 VALUES (?, ?, ?, ?, ?, ?)`
                ).run(
                    id,
                    title,
                    notes || null,
                    priority || "medium",
                    dueDate || null,
                    remindAt || null
                );
                return { success: true, id };
            } catch (e) {
                console.error("[todos:add]", e);
                return { success: false, message: e.message };
            }
        }
    );

    ipcMain.handle(
        "todos:update",
        (event, { id, title, notes, priority, dueDate, remindAt, status }) => {
            try {
                getMasterDb()
                    .prepare(
                        `UPDATE todos
                     SET title = ?, notes = ?, priority = ?, due_date = ?,
                         remind_at = ?, status = ?, reminded = 0, updated_at = datetime('now')
                     WHERE id = ?`
                    )
                    .run(
                        title,
                        notes || null,
                        priority,
                        dueDate || null,
                        remindAt || null,
                        status,
                        id
                    );
                return { success: true };
            } catch (e) {
                console.error("[todos:update]", e);
                return { success: false, message: e.message };
            }
        }
    );

    ipcMain.handle("todos:toggleDone", (event, id) => {
        try {
            const db = getMasterDb();
            const todo = db
                .prepare(`SELECT status FROM todos WHERE id = ?`)
                .get(id);
            if (!todo) return { success: false, message: "Not found" };
            const next = todo.status === "done" ? "pending" : "done";
            db.prepare(
                `UPDATE todos SET status = ?, updated_at = datetime('now') WHERE id = ?`
            ).run(next, id);
            return { success: true, status: next };
        } catch (e) {
            console.error("[todos:toggleDone]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("todos:delete", (event, id) => {
        try {
            getMasterDb().prepare(`DELETE FROM todos WHERE id = ?`).run(id);
            return { success: true };
        } catch (e) {
            console.error("[todos:delete]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("todos:syncVaultReminders", (event, entries) => {
        try {
            generateVaultReminders(entries);
            return { success: true };
        } catch (e) {
            console.error("[todos:syncVaultReminders]", e);
            return { success: false, message: e.message };
        }
    });
}

module.exports = {
    registerTodoHandlers,
    startReminderScheduler,
    stopReminderScheduler,
};
