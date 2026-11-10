const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

export function formatAmount(value) {
    return typeof value === "number" && Number.isFinite(value) ? inr.format(value) : "—";
}

export function formatDate(isoDate) {
    if (!isoDate) return "—";
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function toNumberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

export function errorMessage(err, fallback) {
    return err?.message || fallback;
}
