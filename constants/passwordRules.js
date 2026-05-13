export const PASSWORD_RULES = [
    {
        test: (v) => v.length >= 8 && v.length <= 20,
        msg: "Must be 8–20 characters.",
    },
    { test: (v) => /[a-z]/.test(v), msg: "Must contain a lowercase letter." },
    { test: (v) => /[A-Z]/.test(v), msg: "Must contain an uppercase letter." },
    { test: (v) => /[0-9]/.test(v), msg: "Must contain a number." },
    {
        test: (v) => /[^a-zA-Z0-9]/.test(v),
        msg: "Must contain a special character.",
    },
];

// returns array of error strings (empty = valid)
export function validatePassword(value) {
    if (!value) return [];
    return PASSWORD_RULES.filter((r) => !r.test(value)).map((r) => r.msg);
}

export function getPasswordStrength(value) {
    if (!value) return null;
    const passed = PASSWORD_RULES.filter((r) => r.test(value)).length;
    if (passed <= 2) return { label: "Weak", color: "#ef4444" };
    if (passed <= 3) return { label: "Fair", color: "#f97316" };
    if (passed <= 4) return { label: "Good", color: "#eab308" };
    return { label: "Strong", color: "#22c55e" };
}
