export const VAULT_SCHEMAS = {
    bank: {
        label: "Bank",
        icon: "🏦",
        displayField: "bankName",
        fields: [
            {
                name: "bankName",
                label: "Bank Name",
                type: "text",
                required: true,
            },
            {
                name: "customerId",
                label: "Customer ID",
                type: "text",
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
            {
                name: "netbankingUserId",
                label: "Netbanking User ID",
                type: "text",
            },
            {
                name: "netbankingLoginPassword",
                label: "Netbanking Login Password",
                type: "password",
                masked: true,
            },
            {
                name: "netbankingTxnPassword",
                label: "Netbanking Transaction Password",
                type: "password",
                masked: true,
            },
            {
                name: "mobileBankingLoginPin",
                label: "Mobile Banking Login PIN",
                type: "number",
                masked: true,
            },
            {
                name: "mobileBankingTxnPin",
                label: "Mobile Banking Transaction PIN",
                type: "number",
                masked: true,
            },
        ],
    },
    email: {
        label: "Email",
        icon: "📧",
        displayField: "emailAddress",
        fields: [
            {
                name: "provider",
                label: "Provider",
                type: "text",
                required: true,
                placeholder: "Gmail, Outlook, Yahoo...",
            },
            {
                name: "emailAddress",
                label: "Email Address",
                type: "email",
                required: true,
            },
            {
                name: "password",
                label: "Password",
                type: "password",
                masked: true,
            },
            { name: "recoveryEmail", label: "Recovery Email", type: "email" },
            { name: "recoveryPhone", label: "Recovery Phone", type: "tel" },
        ],
    },
    pan: {
        label: "PAN",
        icon: "🪪",
        displayField: "panNumber",
        fields: [
            {
                name: "panNumber",
                label: "PAN Number",
                type: "text",
                required: true,
                masked: true,
            },
            {
                name: "websitePassword",
                label: "Website Password",
                type: "password",
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
        ],
    },
    pran: {
        label: "PRAN",
        icon: "🏛️",
        displayField: "pranNumber",
        fields: [
            {
                name: "pranNumber",
                label: "PRAN Number",
                type: "text",
                required: true,
                masked: true,
            },
            {
                name: "ipin",
                label: "IPIN (Password)",
                type: "password",
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
        ],
    },

    aadhaar: {
        label: "Aadhaar",
        icon: "🆔",
        displayField: "aadhaarNumber",
        fields: [
            {
                name: "aadhaarNumber",
                label: "Aadhaar Number",
                type: "text",
                required: true,
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
            {
                name: "issueDate",
                label: "Issue Date",
                type: "date",
            },
        ],
    },
    mf: {
        label: "Mutual Funds",
        icon: "📈",
        displayField: "fundName",
        fields: [
            {
                name: "fundName",
                label: "Fund Name",
                type: "text",
                required: true,
            },
            { name: "portfolioIds", label: "Portfolio IDs", type: "list" },
            { name: "userId", label: "User ID", type: "text" },
            {
                name: "password",
                label: "Password",
                type: "password",
                masked: true,
            },
            {
                name: "mobilePin",
                label: "Mobile PIN",
                type: "number",
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
        ],
    },
    passport: {
        label: "Passport",
        icon: "🛂",
        displayField: "passportNumber",
        fields: [
            {
                name: "passportNumber",
                label: "Passport Number",
                type: "text",
                required: true,
                masked: true,
            },
            {
                name: "country",
                label: "Country",
                type: "text",
            },
            {
                name: "issueDate",
                label: "Issue Date",
                type: "date",
            },
            {
                name: "expiryDate",
                label: "Expiry Date",
                type: "date",
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
        ],
    },
    custom: {
        label: "Custom",
        icon: "🔐",
        displayField: "label",
        fields: [
            { name: "label", label: "Label", type: "text", required: true },
            { name: "description", label: "Description", type: "text" },
            { name: "username", label: "Username", type: "text" },
            {
                name: "password",
                label: "Password",
                type: "password",
                masked: true,
            },
            {
                name: "registeredEmail",
                label: "Registered Email",
                type: "email",
            },
            {
                name: "registeredMobile",
                label: "Registered Mobile",
                type: "tel",
            },
            { name: "url", label: "URL", type: "url" },
            { name: "notes", label: "Notes", type: "textarea" },
        ],
    },
};

export const NOTE_SCHEMA = {
    label: "Note",
    icon: "📝",
    displayField: "label",
    fields: [
        {
            name: "label",
            label: "Title",
            type: "text",
            required: true,
        },
        {
            name: "url",
            label: "URL",
            type: "url",
        },
        {
            name: "description",
            label: "Description",
            type: "textarea",
        },
        {
            name: "content",
            label: "Content",
            type: "textarea",
        },
        {
            name: "attributes",
            label: "Custom Attributes",
            type: "kvlist",
        },
        {
            name: "tags",
            label: "Tags",
            type: "list",
        },
    ],
};

export const VAULT_CATEGORY_LIST = Object.entries(VAULT_SCHEMAS).map(
    ([id, schema]) => ({ id, ...schema })
);
