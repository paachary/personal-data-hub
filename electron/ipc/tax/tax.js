const fs = require("fs");
const path = require("path");
const { ipcMain, dialog } = require("electron");
const XLSX = require("xlsx");
const { getFinanceDb } = require("../../../database/finance/financeDb");
const { getSession } = require("../auth.js");
const { fyBounds } = require("../../../lib/tax/dates");
const service = require("../../../lib/tax/service");
const importers = require("../../../lib/tax/importers");
const { TEMPLATE_CSV } = require("../../../lib/tax/importers/template");
const { buildTaxWorkbook, buildTaxSummaryDocx } = require("../../../lib/exporters/taxExporter");
const { syncTaxReminders, removeTaxReminders } = require("../todos/todos");

const IMPORT_KINDS = ["cams", "incomeTemplate", "ais"];
const MAX_COMMIT_ROWS = 5000;

function requireRegularUser() {
    const session = getSession();
    if (!session.userId) throw new Error("Not logged in.");
    if (session.isAdmin) throw new Error("Tax is not available for the sysadmin account.");
    return session.userId;
}

// fyBounds throws on a malformed or inconsistent financial year.
function checkFy(fy) {
    fyBounds(fy);
    return fy;
}

function checkId(id) {
    if (!Number.isInteger(id) || id <= 0) throw new TypeError("Invalid id.");
    return id;
}

function checkObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Invalid payload.");
    }
    return value;
}

const DRAFT_AGE_BANDS = ["below60", "senior", "superSenior"];
const DRAFT_REGIMES = ["compare", "old", "new"];
const DRAFT_AMOUNT_KEYS = [
    "salary", "house_property", "business_income", "tds_tcs",
    "ded_80c", "ded_80d", "ded_80ccd1b", "ded_hra", "ded_24b", "ded_other",
];
const DRAFT_BOOLEAN_KEYS = ["has_business_income", "presumptive_44ad", "use_dividend_forecast"];
const MAX_DRAFT_AMOUNT = 1e12;

// Validates an unsaved profile sent with tax:getOverview. Returns null when absent. Never persisted.
function sanitizeDraft(draft) {
    if (draft == null) return null;
    checkObject(draft);
    if (!DRAFT_AGE_BANDS.includes(draft.age_band)) throw new TypeError("Invalid age band.");
    if (!DRAFT_REGIMES.includes(draft.regime_choice)) throw new TypeError("Invalid regime.");
    const out = { age_band: draft.age_band, regime_choice: draft.regime_choice };
    for (const key of DRAFT_BOOLEAN_KEYS) {
        if (typeof draft[key] !== "boolean") throw new TypeError("Invalid draft flag.");
        out[key] = draft[key];
    }
    for (const key of DRAFT_AMOUNT_KEYS) {
        const value = draft[key];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_DRAFT_AMOUNT) {
            throw new TypeError("Invalid draft amount.");
        }
        out[key] = value;
    }
    const months = draft.filing_months_delay;
    if (!Number.isInteger(months) || months < 0 || months > 12) throw new TypeError("Invalid filing delay.");
    out.filing_months_delay = months;
    return out;
}

// Splits `{ fy, ...data }` from the renderer and validates the financial year.
function splitFy(payload) {
    const { fy, ...data } = checkObject(payload);
    checkFy(fy);
    return { fy, data };
}

// Splits `{ id, ...data }` from the renderer and validates the id.
function splitId(payload) {
    const { id, ...data } = checkObject(payload);
    checkId(id);
    return { id, data };
}

// Creates tax todos when reminders are on, and removes pending ones when off.
function syncRemindersFor(db, userId, fy, enabled) {
    if (!enabled) {
        removeTaxReminders(userId, fy);
        return;
    }
    const overview = service.getOverview(db, userId, fy);
    syncTaxReminders(userId, fy, overview.schedule?.instalments ?? []);
}

// Shows a plaintext warning and returns true only when the user confirms.
async function confirmPlaintextExport(kind) {
    const result = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Export", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        message: `Export tax ${kind} as a plain file?`,
        detail: "The exported file is not encrypted. Anyone with access to it can read your tax data.",
    });
    return result.response === 0;
}

function registerCrudChannels(name, crud) {
    ipcMain.handle(`tax:${name}:list`, (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return crud.list(getFinanceDb(), userId, fy);
    });

    ipcMain.handle(`tax:${name}:add`, (event, payload) => {
        const userId = requireRegularUser();
        const { fy, data } = splitFy(payload);
        return { success: true, id: crud.add(getFinanceDb(), userId, fy, data) };
    });

    ipcMain.handle(`tax:${name}:update`, (event, payload) => {
        const userId = requireRegularUser();
        const { id, data } = splitId(payload);
        return { success: true, changes: crud.update(getFinanceDb(), userId, id, data) };
    });

    ipcMain.handle(`tax:${name}:remove`, (event, id) => {
        const userId = requireRegularUser();
        checkId(id);
        return { success: true, changes: crud.remove(getFinanceDb(), userId, id) };
    });
}

function registerTaxHandlers() {
    ipcMain.handle("tax:financialYears", () => {
        const userId = requireRegularUser();
        return service.listFinancialYears(getFinanceDb(), userId);
    });

    ipcMain.handle("tax:getOverview", (event, fy, draft) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return service.getOverview(getFinanceDb(), userId, fy, sanitizeDraft(draft));
    });

    ipcMain.handle("tax:profile:get", (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return service.getTaxProfile(getFinanceDb(), userId, fy);
    });

    ipcMain.handle("tax:profile:save", (event, payload) => {
        const userId = requireRegularUser();
        const { fy, data } = splitFy(payload);
        if ("reminders_enabled" in data) data.reminders_enabled = data.reminders_enabled ? 1 : 0;
        const db = getFinanceDb();
        const profile = service.saveTaxProfile(db, userId, fy, data);
        syncRemindersFor(db, userId, fy, profile.reminders_enabled === 1);
        return { success: true, profile };
    });

    registerCrudChannels("incomeSources", service.incomeSources);
    registerCrudChannels("dividendHistory", service.dividendHistory);
    registerCrudChannels("payments", service.payments);

    ipcMain.handle("tax:capitalGains:list", (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return service.capitalGains.list(getFinanceDb(), userId, fy);
    });

    ipcMain.handle("tax:capitalGains:add", (event, payload) => {
        const userId = requireRegularUser();
        const { fy, data } = splitFy(payload);
        return { success: true, ...service.capitalGains.add(getFinanceDb(), userId, fy, data) };
    });

    ipcMain.handle("tax:capitalGains:update", (event, payload) => {
        const userId = requireRegularUser();
        const { id, data } = splitId(payload);
        return { success: true, changes: service.capitalGains.update(getFinanceDb(), userId, id, data) };
    });

    ipcMain.handle("tax:capitalGains:remove", (event, id) => {
        const userId = requireRegularUser();
        checkId(id);
        return { success: true, changes: service.capitalGains.remove(getFinanceDb(), userId, id) };
    });

    ipcMain.handle("tax:investments:setInterest", (event, payload) => {
        const userId = requireRegularUser();
        const { investmentId, rate = null, compounding = null } = checkObject(payload);
        checkId(investmentId);
        if (rate !== null && (typeof rate !== "number" || rate < 0 || rate > 30)) {
            throw new RangeError("Interest rate must be between 0 and 30.");
        }
        return {
            success: true,
            changes: service.setInvestmentInterest(getFinanceDb(), userId, investmentId, { rate, compounding }),
        };
    });

    // Preview reads the file and parses it. It never writes to the database.
    ipcMain.handle("tax:import:preview", async (event, payload) => {
        const userId = requireRegularUser();
        const { kind, fy } = checkObject(payload);
        checkFy(fy);
        if (!IMPORT_KINDS.includes(kind)) throw new TypeError("Unknown import kind.");

        const result = await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [{ name: "Spreadsheet or CSV", extensions: importers.EXTENSIONS }],
        });
        if (result.canceled || result.filePaths.length === 0) return { canceled: true };

        const filePath = result.filePaths[0];
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const size = fs.statSync(filePath).size;
        if (size > importers.MAX_FILE_BYTES) throw new Error("The file is larger than 10 MB.");
        const buffer = fs.readFileSync(filePath);

        const preview = importers.previewImport(getFinanceDb(), userId, kind, buffer, ext, fy);
        return { success: true, fileName: path.basename(filePath), ...preview };
    });

    // Commit writes only the rows the user selected in the preview. Each row is re-validated here.
    ipcMain.handle("tax:import:commit", (event, payload) => {
        const userId = requireRegularUser();
        const { kind, fy, rows } = checkObject(payload);
        checkFy(fy);
        if (!Array.isArray(rows) || rows.length > MAX_COMMIT_ROWS) throw new TypeError("Invalid rows.");
        const result = importers.commitRows(getFinanceDb(), userId, fy, kind, rows);
        return { success: true, ...result };
    });

    ipcMain.handle("tax:import:saveTemplate", async () => {
        requireRegularUser();
        const result = await dialog.showSaveDialog({
            defaultPath: "income-template.csv",
            filters: [{ name: "CSV", extensions: ["csv"] }],
        });
        if (result.canceled || !result.filePath) return { canceled: true };
        fs.writeFileSync(result.filePath, TEMPLATE_CSV, "utf8");
        return { success: true };
    });

    ipcMain.handle("tax:exportExcel", async (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        if (!(await confirmPlaintextExport("data as Excel"))) return { canceled: true };
        const overview = service.getOverview(getFinanceDb(), userId, fy);
        const result = await dialog.showSaveDialog({
            defaultPath: `advance-tax-${fy}.xlsx`,
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
        });
        if (result.canceled || !result.filePath) return { canceled: true };
        XLSX.writeFile(buildTaxWorkbook({ ...overview, fy }), result.filePath);
        return { success: true };
    });

    ipcMain.handle("tax:exportWord", async (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        if (!(await confirmPlaintextExport("summary as Word"))) return { canceled: true };
        const overview = service.getOverview(getFinanceDb(), userId, fy);
        const result = await dialog.showSaveDialog({
            defaultPath: `advance-tax-${fy}.docx`,
            filters: [{ name: "Word", extensions: ["docx"] }],
        });
        if (result.canceled || !result.filePath) return { canceled: true };
        fs.writeFileSync(result.filePath, await buildTaxSummaryDocx({ ...overview, fy }));
        return { success: true };
    });
}

module.exports = { registerTaxHandlers };
