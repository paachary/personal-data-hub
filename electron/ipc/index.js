const { registerAuthHandlers } = require("./auth");
const { registerBankHandlers } = require("./finance/banks");
const { registerInvestmentHandlers } = require("./finance/investments");
const { registerVaultHandlers } = require("./vault/vault");
const { registerSettingsHandlers } = require("./settings/settings");
const { registerAdminUserHandlers } = require("./admin/users");
const { registerTodoHandlers } = require("./todos/todos");
const { ipcMain } = require("electron");

function registerAllHandlers() {
    registerAuthHandlers();
    registerVaultHandlers(); // add future handlers here
    registerBankHandlers();
    registerInvestmentHandlers();
    registerSettingsHandlers();
    registerAdminUserHandlers();
    registerTodoHandlers();

    ipcMain.on("help:setSection", (event, section) => {
        const { setCurrentSection } = require("../main");
        setCurrentSection(section);
    });
}

module.exports = { registerAllHandlers };
