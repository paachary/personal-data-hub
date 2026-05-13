export const NAV_SECTIONS = [
    {
        group: "General",
        items: [{ id: "dashboard", label: "🏠 Dashboard" }],
    },
    {
        group: "Vault",
        items: [
            { id: "passwords", label: "🔑 Passwords" },
            { id: "notes", label: "📝 Secure Notes" },
            { id: "todos", label: "📋 To-Do & Reminders" },
        ],
    },
    {
        group: "Finance",
        items: [
            { id: "banks", label: "🏦 Banks & Accounts" },
            { id: "investments", label: "📈 Investments" },
        ],
    },
    {
        group: "Settings",
        items: [{ id: "settings", label: "⚙️ Settings" }],
    },
    {
        group: "Security", // ← new group
        items: [{ id: "mfa-help", label: "🔐 MFA Guide" }],
    },
];

// Admin-only settings sub-items
export const ADMIN_SETTINGS_SECTIONS = [
    { id: "settings-banks", label: "🏛️ Bank Master" },
    { id: "settings-instrument-types", label: "📊 Instrument Types" },
    { id: "settings-investment-types", label: "🔄 Investment Types" },
    { id: "admin-users", label: "👥 User Management" },
];

export const ADMIN_REPORT_SECTIONS = [
    { id: "reports-investments", label: "📊 Investment Report" },
];

export const SECTION_SUBTITLES = {
    dashboard: "Here's an overview of your data.",
    passwords: "Manage your saved passwords.",
    notes: "Your secure private notes.",
    investments: "Track all your investments.",
    banks: "Manage your bank accounts.",
    settings: "Manage your account settings.",
    "settings-banks": "Manage bank master data.",
    "settings-instrument-types": "Manage instrument types (FD, MF, LIC...).",
    "settings-investment-types": "Manage investment types (SIP, SWP...).",
    "mfa-help": "Learn how to use Two-Factor Authentication.",
    todos: "Your to-do list and reminders.", // ← Add
};

export const SECTION_TITLES = {
    passwords: "🔑 Passwords",
    notes: "📝 Secure Notes",
    investments: "📈 Investments",
    banks: "🏦 Banks & Accounts",
    settings: "⚙️ Settings",
    "settings-banks": "🏛️ Bank Master",
    "settings-instrument-types": "📊 Instrument Types",
    "settings-investment-types": "🔄 Investment Types",
    "mfa-help": "🔐 MFA Guide", // ← add
    todos: "📋 To-Do & Reminders", // ← Add
};

export const DASHBOARD_STATS = [
    { id: "passwords", icon: "🔑", label: "Passwords", value: "0" },
    { id: "notes", icon: "📝", label: "Secure Notes", value: "0" },
    { id: "todos", icon: "📋", label: "Pending Todos", value: "0" },
    { id: "investments", icon: "📈", label: "Investments", value: "0" },
    { id: "accounts", icon: "🏦", label: "Accounts", value: "0" },
    { id: "banks", icon: "🏛️", label: "Banks", value: "0" },
];
