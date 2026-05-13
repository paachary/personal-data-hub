const { ipcMain, dialog, app } = require("electron");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const os = require("os");
const fs = require("fs");
const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType,
    PageOrientation,
    Header,
    Footer,
    PageNumber,
    TabStopPosition,
    TabStopType,
} = require("docx");
const { getVaultKey, encrypt, decrypt, getDb } = require("../../vault/vaultDb");
const { getSession } = require("../auth");

// ── Field Label Mapping ───────────────────────────────────

const FIELD_LABELS = {
    label: "Label / Title",
    title: "Title",
    username: "Username",
    email: "Email Address",
    password: "Password",
    url: "Website / URL",
    notes: "Notes",
    tags: "Tags",
    attributes: "Custom Fields",
    description: "Description",
    content: "Content",
    cardNumber: "Card Number",
    expiryDate: "Expiry Date",
    cvv: "CVV",
    cardHolder: "Cardholder Name",
    pin: "PIN",
    bankName: "Bank Name",
    accountNumber: "Account Number",
    sortCode: "Sort Code",
    iban: "IBAN",
    swift: "SWIFT / BIC",
    phone: "Phone Number",
    address: "Address",
    securityQ: "Security Question",
    securityA: "Security Answer",
    licenseKey: "License Key",
};

const SKIP_FIELDS = new Set(["id", "type"]);
const COLORS = {
    headerBg: "1E3A5F",
    headerText: "FFFFFF",
    rowAlt: "EFF6FF",
    rowNormal: "FFFFFF",
    accent: "2563EB",
    muted: "64748B",
    warning: "CC0000",
    border: "BFDBFE",
    labelBg: "DBEAFE",
    labelText: "1E3A5F",
    bodyText: "1E293B",
};

function friendlyLabel(key) {
    return (
        FIELD_LABELS[key] ??
        key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
    );
}

function friendlyValue(key, value) {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) {
        if (!value.length) return "—";
        return value
            .map((item) =>
                typeof item === "object"
                    ? `${item.key}: ${item.value}`
                    : String(item)
            )
            .join(",  ");
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

// ── Document Builders ─────────────────────────────────────

function makeTitle(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text,
                bold: true,
                size: 52,
                font: "Calibri",
                color: COLORS.headerBg,
            }),
        ],
        spacing: { before: 0, after: 160 },
    });
}

function makeMeta(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text,
                italics: true,
                size: 18,
                font: "Calibri",
                color: COLORS.muted,
            }),
        ],
        spacing: { before: 0, after: 60 },
    });
}

function makeDivider() {
    return new Paragraph({
        text: "",
        border: {
            bottom: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: COLORS.accent,
                space: 4,
            },
        },
        spacing: { before: 160, after: 160 },
    });
}

function makeWarning(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text,
                bold: true,
                size: 18,
                font: "Calibri",
                color: COLORS.warning,
            }),
        ],
        spacing: { before: 80, after: 80 },
        shading: { fill: "FEF2F2", type: ShadingType.CLEAR },
    });
}

function makeSectionHeading(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text: `  ${text}  `,
                bold: true,
                size: 26,
                font: "Calibri",
                color: COLORS.headerText,
            }),
        ],
        shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
        spacing: { before: 400, after: 160 },
    });
}

function makeEntryHeading(text, index) {
    return new Paragraph({
        children: [
            new TextRun({
                text: `${index}.  ${text}`,
                bold: true,
                size: 24,
                font: "Calibri",
                color: COLORS.accent,
            }),
        ],
        spacing: { before: 280, after: 80 },
        border: {
            bottom: {
                style: BorderStyle.SINGLE,
                size: 2,
                color: COLORS.border,
                space: 4,
            },
        },
    });
}

function makeEntryDate(dateStr) {
    if (!dateStr) return null;
    return new Paragraph({
        children: [
            new TextRun({
                text: `Added: ${new Date(dateStr).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                })}`,
                italics: true,
                size: 17,
                font: "Calibri",
                color: COLORS.muted,
            }),
        ],
        spacing: { before: 0, after: 100 },
    });
}

function makeSpacer() {
    return new Paragraph({
        text: "",
        spacing: { before: 80, after: 80 },
    });
}

function makeEntryTable(data) {
    const pairs = Object.entries(data).filter(
        ([k, v]) =>
            !SKIP_FIELDS.has(k) &&
            v !== undefined &&
            v !== null &&
            v !== "" &&
            !(Array.isArray(v) && v.length === 0)
    );

    if (!pairs.length) return null;

    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Field",
                                bold: true,
                                color: COLORS.headerText,
                                size: 20,
                                font: "Calibri",
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { before: 60, after: 60 },
                    }),
                ],
                shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
                width: { size: 28, type: WidthType.PERCENTAGE },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                borders: {
                    right: {
                        style: BorderStyle.SINGLE,
                        size: 2,
                        color: "3B82F6",
                    },
                },
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Value",
                                bold: true,
                                color: COLORS.headerText,
                                size: 20,
                                font: "Calibri",
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { before: 60, after: 60 },
                    }),
                ],
                shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
                width: { size: 72, type: WidthType.PERCENTAGE },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
        ],
    });

    const dataRows = pairs.map(([k, v], idx) => {
        const isAlt = idx % 2 !== 0;
        const bgFill = isAlt ? COLORS.rowAlt : COLORS.rowNormal;

        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: friendlyLabel(k),
                                    bold: true,
                                    size: 19,
                                    font: "Calibri",
                                    color: COLORS.labelText,
                                }),
                            ],
                            spacing: { before: 60, after: 60 },
                        }),
                    ],
                    shading: { fill: bgFill, type: ShadingType.CLEAR },
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    borders: {
                        right: {
                            style: BorderStyle.SINGLE,
                            size: 1,
                            color: COLORS.border,
                        },
                    },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: friendlyValue(k, v),
                                    size: 19,
                                    font: "Calibri",
                                    color: COLORS.bodyText,
                                }),
                            ],
                            spacing: { before: 60, after: 60 },
                        }),
                    ],
                    shading: { fill: bgFill, type: ShadingType.CLEAR },
                    width: { size: 72, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                }),
            ],
        });
    });

    return new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            bottom: {
                style: BorderStyle.SINGLE,
                size: 2,
                color: COLORS.border,
            },
            left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            insideH: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: COLORS.border,
            },
            insideV: { style: BorderStyle.NONE },
        },
    });
}

function makeFooter(label, count, username) {
    return new Footer({
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${label}   •   ${username}   •   ${count} entries   •   ${new Date().getFullYear()}`,
                        size: 16,
                        font: "Calibri",
                        color: COLORS.muted,
                        italics: true,
                    }),
                    new TextRun({
                        children: [
                            "   Page ",
                            PageNumber.CURRENT,
                            " of ",
                            PageNumber.TOTAL_PAGES,
                        ],
                        size: 16,
                        font: "Calibri",
                        color: COLORS.muted,
                    }),
                ],
                alignment: AlignmentType.CENTER,
            }),
        ],
    });
}

// ── Helpers ───────────────────────────────────────────────

function getEntries() {
    return getDb().read()?.entries ?? [];
}
function getNotes() {
    return getDb().read()?.notes ?? [];
}

function saveEntries(entries) {
    const db = getDb();
    db.write({ ...db.read(), entries });
}
function saveNotes(notes) {
    const db = getDb();
    db.write({ ...db.read(), notes });
}

function decryptEntries(entries, key) {
    return entries.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        data: JSON.parse(decrypt(e.data, key)),
    }));
}

// ── Register Handlers ─────────────────────────────────────

function registerVaultHandlers() {
    // ── Password CRUD ─────────────────────────────────────

    ipcMain.handle("vault:getAll", async () => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            return {
                success: true,
                entries: decryptEntries(getEntries(), key),
            };
        } catch (e) {
            console.error("[vault:getAll]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("vault:add", async (event, { type, data }) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            const entries = getEntries();
            entries.push({
                id: uuidv4(),
                type,
                data: encrypt(JSON.stringify(data), key),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            saveEntries(entries);
            return { success: true };
        } catch (e) {
            console.error("[vault:add]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("vault:update", async (event, { id, data }) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            const entries = getEntries();
            const idx = entries.findIndex((e) => e.id === id);
            if (idx === -1)
                return { success: false, message: "Entry not found" };
            entries[idx] = {
                ...entries[idx],
                data: encrypt(JSON.stringify(data), key),
                updatedAt: new Date().toISOString(),
            };
            saveEntries(entries);
            return { success: true };
        } catch (e) {
            console.error("[vault:update]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("vault:delete", async (event, id) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            saveEntries(getEntries().filter((e) => e.id !== id));
            return { success: true };
        } catch (e) {
            console.error("[vault:delete]", e);
            return { success: false, message: e.message };
        }
    });

    // ── Notes CRUD ────────────────────────────────────────

    ipcMain.handle("notes:getAll", async () => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            return { success: true, notes: decryptEntries(getNotes(), key) };
        } catch (e) {
            console.error("[notes:getAll]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("notes:add", async (event, data) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            const notes = getNotes();
            notes.push({
                id: uuidv4(),
                type: "note",
                data: encrypt(JSON.stringify(data), key),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            saveNotes(notes);
            return { success: true };
        } catch (e) {
            console.error("[notes:add]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("notes:update", async (event, { id, data }) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            const notes = getNotes();
            const idx = notes.findIndex((n) => n.id === id);
            if (idx === -1)
                return { success: false, message: "Note not found" };
            notes[idx] = {
                ...notes[idx],
                data: encrypt(JSON.stringify(data), key),
                updatedAt: new Date().toISOString(),
            };
            saveNotes(notes);
            return { success: true };
        } catch (e) {
            console.error("[notes:update]", e);
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle("notes:delete", async (event, id) => {
        const key = getVaultKey();
        if (!key) return { success: false, message: "Not authenticated" };
        try {
            saveNotes(getNotes().filter((n) => n.id !== id));
            return { success: true };
        } catch (e) {
            console.error("[notes:delete]", e);
            return { success: false, message: e.message };
        }
    });

    // ── Export Passwords ──────────────────────────────────

    ipcMain.handle("vault:exportPasswords", async () => {
        try {
            const key = getVaultKey();
            const session = getSession();
            const date = new Date().toISOString().slice(0, 10);
            const entries = decryptEntries(getEntries(), key);

            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Export Passwords",
                defaultPath: path.join(
                    os.homedir(),
                    "Desktop",
                    `passwords-${session.username}-${date}.docx`
                ),
                filters: [{ name: "Word Document", extensions: ["docx"] }],
            });

            if (canceled || !filePath) return { success: false };

            // Group by type/category
            const grouped = entries.reduce((acc, e) => {
                const cat = (e.type || "General")
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(e);
                return acc;
            }, {});

            const children = [
                makeTitle("Password Vault Export"),
                makeMeta(
                    `Exported by: ${session.fullName}  (@${session.username})`
                ),
                makeMeta(`Generated:   ${new Date().toLocaleString("en-GB")}`),
                makeSpacer(),
                makeWarning(
                    "⚠  CONFIDENTIAL — This document contains sensitive information. Store securely and delete after use."
                ),
                makeDivider(),
            ];

            let idx = 1;

            for (const [category, items] of Object.entries(grouped)) {
                children.push(
                    makeSectionHeading(`📁  ${category}  (${items.length})`)
                );

                for (const entry of items) {
                    const label =
                        entry.data.label ||
                        entry.data.title ||
                        entry.data.username ||
                        `Entry ${idx}`;

                    children.push(makeEntryHeading(label, idx++));

                    const dateEl = makeEntryDate(entry.createdAt);
                    if (dateEl) children.push(dateEl);

                    const table = makeEntryTable(entry.data);
                    if (table) children.push(table);

                    children.push(makeSpacer());
                }
            }

            children.push(makeDivider());
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Total entries: ${
                                entries.length
                            }   •   Personal Data   •   ${new Date().getFullYear()}`,
                            size: 16,
                            font: "Calibri",
                            color: COLORS.muted,
                            italics: true,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                })
            );

            const doc = new Document({
                sections: [
                    {
                        properties: {
                            page: {
                                margin: {
                                    top: 1000,
                                    bottom: 1000,
                                    left: 1200,
                                    right: 1200,
                                },
                            },
                        },
                        footers: {
                            default: makeFooter(
                                "Password Export",
                                entries.length,
                                session.username
                            ),
                        },
                        children,
                    },
                ],
            });

            fs.writeFileSync(filePath, await Packer.toBuffer(doc));
            return { success: true };
        } catch (e) {
            console.error("[vault:exportPasswords]", e);
            return { success: false, message: e.message };
        }
    });

    // ── Export Notes ──────────────────────────────────────

    ipcMain.handle("vault:exportNotes", async () => {
        try {
            const key = getVaultKey();
            const session = getSession();
            const date = new Date().toISOString().slice(0, 10);
            const notes = decryptEntries(getNotes(), key);

            const { filePath, canceled } = await dialog.showSaveDialog({
                title: "Export Notes",
                defaultPath: path.join(
                    os.homedir(),
                    "Desktop",
                    `notes-${session.username}-${date}.docx`
                ),
                filters: [{ name: "Word Document", extensions: ["docx"] }],
            });

            if (canceled || !filePath) return { success: false };

            const children = [
                makeTitle("Secure Notes Export"),
                makeMeta(
                    `Exported by: ${session.fullName}  (@${session.username})`
                ),
                makeMeta(`Generated:   ${new Date().toLocaleString("en-GB")}`),
                makeDivider(),
            ];

            notes.forEach((note, i) => {
                const d = note.data;
                const title = d.label || d.title || "Untitled Note";

                children.push(makeEntryHeading(title, i + 1));

                const dateEl = makeEntryDate(note.createdAt);
                if (dateEl) children.push(dateEl);

                // Build field map — only non-empty fields
                const tableData = {};
                if (d.description) tableData.description = d.description;
                if (d.url) tableData.url = d.url;
                if (d.content) tableData.content = d.content;
                if (d.tags?.length) tableData.tags = d.tags;
                if (d.attributes?.length) tableData.attributes = d.attributes;

                const table = makeEntryTable(tableData);
                if (table) children.push(table);

                children.push(makeSpacer());
            });

            children.push(makeDivider());
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Total notes: ${
                                notes.length
                            }   •   Personal Data   •   ${new Date().getFullYear()}`,
                            size: 16,
                            font: "Calibri",
                            color: COLORS.muted,
                            italics: true,
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                })
            );

            const doc = new Document({
                sections: [
                    {
                        properties: {
                            page: {
                                margin: {
                                    top: 1000,
                                    bottom: 1000,
                                    left: 1200,
                                    right: 1200,
                                },
                            },
                        },
                        footers: {
                            default: makeFooter(
                                "Notes Export",
                                notes.length,
                                session.username
                            ),
                        },
                        children,
                    },
                ],
            });

            fs.writeFileSync(filePath, await Packer.toBuffer(doc));
            return { success: true };
        } catch (e) {
            console.error("[vault:exportNotes]", e);
            return { success: false, message: e.message };
        }
    });
}

module.exports = { registerVaultHandlers };
