"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import { errorMessage, formatAmount, formatDate, toNumberOrNull } from "./format";
import ImportDialog from "./ImportDialog";

const CATEGORY_OPTIONS = [
    { value: "stcg111A", label: "STCG on listed equity (111A)", short: "STCG 111A" },
    { value: "ltcg112A", label: "LTCG on listed equity (112A)", short: "LTCG 112A" },
    { value: "ltcgOther", label: "LTCG on other assets (112)", short: "LTCG 112" },
    { value: "stcgOther", label: "STCG on other assets (slab rate)", short: "STCG other" },
];

const ASSET_OPTIONS = [
    { value: "equity", label: "Equity or equity fund" },
    { value: "debt", label: "Debt fund or bond" },
    { value: "other", label: "Other" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.short]));

// Indian FY runs 1 April to 31 March.
function fyRange(fy) {
    const startYear = Number(fy.slice(0, 4));
    return { min: `${startYear}-04-01`, max: `${startYear + 1}-03-31` };
}

function emptyForm() {
    return {
        asset_class: "equity",
        category: "stcg111A",
        description: "",
        sale_date: "",
        purchase_date: "",
        sale_value: "",
        cost: "",
        gain: "",
        needs_review: false,
    };
}

function fromRow(row) {
    return {
        asset_class: row.asset_class || "other",
        category: row.category,
        description: row.description || "",
        sale_date: row.sale_date || "",
        purchase_date: row.purchase_date || "",
        sale_value: row.sale_value != null ? String(row.sale_value) : "",
        cost: row.cost != null ? String(row.cost) : "",
        gain: row.gain != null ? String(row.gain) : "",
        needs_review: Boolean(row.needs_review),
    };
}

export default function CapitalGainsTab({ fy, exemption }) {
    const [rows, setRows] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [editing, setEditing] = useState(null); // null | "new" | row id
    const [importing, setImporting] = useState(false);

    const load = useCallback(() => window.electronAPI.tax.capitalGains.list(fy), [fy]);

    useEffect(() => {
        let active = true;
        load()
            .then((data) => active && setRows(data))
            .catch((err) => active && setLoadError(errorMessage(err, "Could not load capital gains.")));
        return () => {
            active = false;
        };
    }, [load]);

    const refresh = async () => setRows(await load());

    if (loadError) return <div className={taxStyles.error}>{loadError}</div>;
    if (!rows) return <div className={taxStyles.empty}><p>Loading capital gains…</p></div>;

    const sumWhere = (cats) => rows
        .filter((r) => cats.includes(r.category))
        .reduce((sum, r) => sum + (Number(r.gain) || 0), 0);
    const stcg = sumWhere(["stcg111A", "stcgOther"]);
    const ltcg = sumWhere(["ltcg112A", "ltcgOther"]);
    const reviewCount = rows.filter((r) => r.needs_review).length;

    const handleDelete = async (row) => {
        if (!confirm(`Delete this ${CATEGORY_LABEL[row.category] || ""} entry? This cannot be undone.`)) return;
        setError("");
        setMessage("");
        try {
            await window.electronAPI.tax.capitalGains.remove(row.id);
            setMessage("Capital gain deleted.");
            await refresh();
        } catch (err) {
            setError(errorMessage(err, "Could not delete the entry."));
        }
    };

    return (
        <div>
            {error && <div className={taxStyles.error}>{error}</div>}
            {message && <div className={`${taxStyles.banner} ${taxStyles.info}`} role="status">{message}</div>}
            {reviewCount > 0 && (
                <div className={`${taxStyles.banner} ${taxStyles.warning}`} role="alert">
                    {reviewCount} {reviewCount === 1 ? "entry needs" : "entries need"} review.
                </div>
            )}

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Short-term gains (STCG)</div>
                    <div className={styles.summaryValue}>{formatAmount(stcg)}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Long-term gains (LTCG)</div>
                    <div className={styles.summaryValue}>{formatAmount(ltcg)}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>112A exemption</div>
                    <div className={styles.summaryValue}>{formatAmount(exemption)}</div>
                    <div className={styles.summaryChange}>Applied to listed-equity LTCG only</div>
                </div>
            </div>

            <div className={styles.actions} style={{ margin: "12px 0" }}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing("new")}>
                    Add gain
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setImporting(true)}>
                    Import
                </button>
            </div>

            {importing && (
                <ImportDialog
                    kind="cams"
                    fy={fy}
                    onClose={() => setImporting(false)}
                    onImported={async (text) => {
                        setImporting(false);
                        setMessage(text);
                        await refresh();
                    }}
                />
            )}

            {editing && (
                <CapitalGainForm
                    fy={fy}
                    existing={editing === "new" ? null : rows.find((r) => r.id === editing)}
                    onCancel={() => setEditing(null)}
                    onSaved={async (text) => {
                        setEditing(null);
                        setMessage(text);
                        await refresh();
                    }}
                />
            )}

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Purchased</th>
                            <th>Sold</th>
                            <th className={taxStyles.numeric}>Sale value</th>
                            <th className={taxStyles.numeric}>Cost</th>
                            <th className={taxStyles.numeric}>Gain</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={9}>No capital gains recorded for FY {fy}.</td></tr>
                        )}
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td>{CATEGORY_LABEL[row.category] || row.category}</td>
                                <td>{row.description || "—"}</td>
                                <td>{formatDate(row.purchase_date)}</td>
                                <td>{formatDate(row.sale_date)}</td>
                                <td className={taxStyles.numeric}>{formatAmount(row.sale_value)}</td>
                                <td className={taxStyles.numeric}>{formatAmount(row.cost)}</td>
                                <td className={taxStyles.numeric}>{formatAmount(row.gain)}</td>
                                <td>
                                    {row.needs_review ? (
                                        <span className={`${taxStyles.banner} ${taxStyles.warning}`}>Needs review</span>
                                    ) : (
                                        "OK"
                                    )}
                                </td>
                                <td>
                                    <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                        onClick={() => setEditing(row.id)}>Edit</button>{" "}
                                    <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                        onClick={() => handleDelete(row)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CapitalGainForm({ fy, existing, onCancel, onSaved }) {
    const [form, setForm] = useState(() => (existing ? fromRow(existing) : emptyForm()));
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const range = fyRange(fy);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const saleValue = toNumberOrNull(form.sale_value);
    const cost = toNumberOrNull(form.cost);
    const bothPresent = saleValue !== null && cost !== null && !Number.isNaN(saleValue) && !Number.isNaN(cost);
    const computedGain = bothPresent ? saleValue - cost : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!form.sale_date) return setFormError("Sale date is required.");
        if (form.sale_date < range.min || form.sale_date > range.max) {
            return setFormError(`Sale date must fall within FY ${fy} (${range.min} to ${range.max}).`);
        }
        if (form.purchase_date && form.purchase_date > form.sale_date) {
            return setFormError("Purchase date cannot be after the sale date.");
        }
        const gain = bothPresent ? computedGain : toNumberOrNull(form.gain);
        if (gain === null || Number.isNaN(gain)) {
            return setFormError("Enter sale value and cost, or enter the gain directly.");
        }
        if (Number.isNaN(saleValue) || Number.isNaN(cost)) return setFormError("Amounts must be numbers.");

        const payload = {
            asset_class: form.asset_class,
            category: form.category,
            description: form.description.trim() || null,
            sale_date: form.sale_date,
            purchase_date: form.purchase_date || null,
            sale_value: saleValue,
            cost,
            gain,
            needs_review: form.needs_review,
        };

        setSaving(true);
        try {
            if (existing) {
                await window.electronAPI.tax.capitalGains.update({ id: existing.id, ...payload });
                await onSaved("Capital gain updated.");
            } else {
                const result = await window.electronAPI.tax.capitalGains.add({ fy, ...payload, source: "manual" });
                await onSaved(result?.inserted === false ? "Identical entry already exists; nothing added." : "Capital gain added.");
            }
        } catch (err) {
            setFormError(errorMessage(err, "Could not save the capital gain."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.fields} style={{ marginBottom: 16 }}>
            <h3 className={taxStyles.subsectionTitle} style={{ gridColumn: "1 / -1" }}>
                {existing ? "Edit capital gain" : "Add capital gain"}
            </h3>
            {formError && <div className={taxStyles.error} style={{ gridColumn: "1 / -1" }}>{formError}</div>}

            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-category">Category</label>
                <select id="cg-category" className={styles.select} value={form.category}
                    onChange={(e) => set("category", e.target.value)}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-asset">Asset type</label>
                <select id="cg-asset" className={styles.select} value={form.asset_class}
                    onChange={(e) => set("asset_class", e.target.value)}>
                    {ASSET_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-desc">Description</label>
                <input id="cg-desc" className={styles.input} value={form.description}
                    onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-purchase">Purchase date</label>
                <input id="cg-purchase" className={styles.input} type="date" value={form.purchase_date}
                    onChange={(e) => set("purchase_date", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-sale-date">Sale date (in FY {fy})</label>
                <input id="cg-sale-date" className={styles.input} type="date" min={range.min} max={range.max}
                    value={form.sale_date} onChange={(e) => set("sale_date", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-sale">Sale value (₹)</label>
                <input id="cg-sale" className={styles.input} type="number" step="1" value={form.sale_value}
                    onChange={(e) => set("sale_value", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-cost">Cost (₹)</label>
                <input id="cg-cost" className={styles.input} type="number" step="1" value={form.cost}
                    onChange={(e) => set("cost", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="cg-gain">
                    Gain (₹){bothPresent ? " (calculated)" : ""}
                </label>
                <input id="cg-gain" className={styles.input} type="number" step="1"
                    value={bothPresent ? String(computedGain) : form.gain}
                    readOnly={bothPresent}
                    onChange={(e) => set("gain", e.target.value)} />
            </div>
            <label className={styles.label}>
                <input type="checkbox" checked={form.needs_review}
                    onChange={(e) => set("needs_review", e.target.checked)} /> Needs review
            </label>

            <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? "Saving…" : existing ? "Update" : "Add"}
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
