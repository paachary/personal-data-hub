const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    register: (data) => ipcRenderer.invoke("auth:register", data),
    login: (data) => ipcRenderer.invoke("auth:login", data),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getSession: () => ipcRenderer.invoke("auth:session"),
    setHelpSection: (section) => ipcRenderer.send("help:setSection", section),

    vault: {
        getAll: () => ipcRenderer.invoke("vault:getAll"),
        add: (type, data) => ipcRenderer.invoke("vault:add", { type, data }),
        update: (id, data) => ipcRenderer.invoke("vault:update", { id, data }),
        delete: (id) => ipcRenderer.invoke("vault:delete", id),
        exportPasswords: () => ipcRenderer.invoke("vault:exportPasswords"),
        exportNotes: () => ipcRenderer.invoke("vault:exportNotes"),
    },

    notes: {
        getAll: () => ipcRenderer.invoke("notes:getAll"),
        add: (data) => ipcRenderer.invoke("notes:add", data),
        update: (id, data) => ipcRenderer.invoke("notes:update", { id, data }),
        delete: (id) => ipcRenderer.invoke("notes:delete", id),
    },

    banks: {
        getAll: () => ipcRenderer.invoke("banks:getAll"),
        add: (data) => ipcRenderer.invoke("banks:add", data),
        update: (data) => ipcRenderer.invoke("banks:update", data),
        delete: (id) => ipcRenderer.invoke("banks:delete", id),
        getAllUsers: () => ipcRenderer.invoke("banks:getAllUsers"), // ← add
    },

    accounts: {
        getByUser: (userId) => ipcRenderer.invoke("accounts:getByUser", userId),
        add: (data) => ipcRenderer.invoke("accounts:add", data),
        update: (data) => ipcRenderer.invoke("accounts:update", data),
        delete: (id) => ipcRenderer.invoke("accounts:delete", id),
    },

    investments: {
        getByUser: (userId) =>
            ipcRenderer.invoke("investments:getByUser", userId),
        getAllUsers: () => ipcRenderer.invoke("investments:getAllUsers"), // ← add
        add: (data) => ipcRenderer.invoke("investments:add", data),
        update: (data) => ipcRenderer.invoke("investments:update", data),
        delete: (id) => ipcRenderer.invoke("investments:delete", id),
        getInstrumentTypes: () =>
            ipcRenderer.invoke("finance:getInstrumentTypes"),
        addInstrumentType: (data) =>
            ipcRenderer.invoke("finance:addInstrumentType", data),
        updateInstrumentType: (data) =>
            ipcRenderer.invoke("finance:updateInstrumentType", data),
        deleteInstrumentType: (id) =>
            ipcRenderer.invoke("finance:deleteInstrumentType", id),
        getInvestmentTypes: () =>
            ipcRenderer.invoke("finance:getInvestmentTypes"),
        addInvestmentType: (data) =>
            ipcRenderer.invoke("finance:addInvestmentType", data),
        updateInvestmentType: (data) =>
            ipcRenderer.invoke("finance:updateInvestmentType", data),
        deleteInvestmentType: (id) =>
            ipcRenderer.invoke("finance:deleteInvestmentType", id),
    },

    settings: {
        getProfile: (userId) =>
            ipcRenderer.invoke("settings:getProfile", userId),
        updateProfile: (data) =>
            ipcRenderer.invoke("settings:updateProfile", data),
        changePassword: (data) =>
            ipcRenderer.invoke("settings:changePassword", data),
    },
    admin: {
        users: {
            getAll: () => ipcRenderer.invoke("admin:users:getAll"),
            resetPassword: (data) =>
                ipcRenderer.invoke("admin:users:resetPassword", data),
            changePassword: (data) =>
                ipcRenderer.invoke("admin:users:changePassword", data),
        },
    },
    auth: {
        mfa: {
            setup: () => ipcRenderer.invoke("auth:mfa:setup"),
            verifySetup: (data) =>
                ipcRenderer.invoke("auth:mfa:verify-setup", data),
            verifyLogin: (data) =>
                ipcRenderer.invoke("auth:mfa:verify-login", data),
            reset: (data) => ipcRenderer.invoke("auth:mfa:reset", data),
        },
    },
    todos: {
        getAll: () => ipcRenderer.invoke("todos:getAll"),
        add: (data) => ipcRenderer.invoke("todos:add", data),
        update: (data) => ipcRenderer.invoke("todos:update", data),
        toggleDone: (id) => ipcRenderer.invoke("todos:toggleDone", id),
        delete: (id) => ipcRenderer.invoke("todos:delete", id),
        syncVaultReminders: (entries) =>
            ipcRenderer.invoke("todos:syncVaultReminders", entries),
    },
});
