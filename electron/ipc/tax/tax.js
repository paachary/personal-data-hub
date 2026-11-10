const { ipcMain } = require("electron");
const { getFinanceDb } = require("../../../database/finance/financeDb");
const { getSession } = require("../auth.js");
const { fyBounds } = require("../../../lib/tax/dates");
const service = require("../../../lib/tax/service");

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

    ipcMain.handle("tax:getOverview", (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return service.getOverview(getFinanceDb(), userId, fy);
    });

    ipcMain.handle("tax:profile:get", (event, fy) => {
        const userId = requireRegularUser();
        checkFy(fy);
        return service.getTaxProfile(getFinanceDb(), userId, fy);
    });

    ipcMain.handle("tax:profile:save", (event, payload) => {
        const userId = requireRegularUser();
        const { fy, data } = splitFy(payload);
        return { success: true, profile: service.saveTaxProfile(getFinanceDb(), userId, fy, data) };
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
}

module.exports = { registerTaxHandlers };
