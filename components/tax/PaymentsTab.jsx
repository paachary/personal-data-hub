"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import { errorMessage, formatAmount, formatDate, toNumberOrNull } from "./format";

const KIND_OPTIONS = [
    { value: "advance", label: "Advance tax" },
    { value: "self-assessment", label: "Self-assessment tax" },
];

const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k.label]));

function fyRange(fy) {
    const startYear = Number(fy.slice(0, 4));
    return { min: `${startYear}-04-01`, max: `${startYear + 1}-03-31` };
}

export default function PaymentsTab({ fy }) {
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [adding, setAdding] = useState(false);

    const load = useCallback(() => window.electronAPI.tax.getOverview(fy), [fy]);

    useEffect(() => {
        let active = true;
        load()
            .then((overview) => active && setData(overview))
            .catch((err) => active && setLoadError(errorMessage(err, "Could not load payments.")));
        return () => {
            active = false;
        };
    }, [load]);

    const refresh = async () => setData(await load());

    if (loadError) return <div className={taxStyles.error}>{loadError}</div>;
    if (!data) return <div className={taxStyles.empty}><p>Loading payments…</p></div>;

    const payments = data.payments || [];
    const instalments = data.schedule?.instalments || [];
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const handleDelete = async (payment) => {
        if (!confirm(`Delete the payment of ${formatAmount(payment.amount)} on ${formatDate(payment.paid_on)}? This cannot be undone.`)) return;
        setError("");
        setMessage("");
        try {
            await window.electronAPI.tax.payments.remove(payment.id);
            setMessage("Payment deleted.");
            await refresh();
        } catch (err) {
            setError(errorMessage(err, "Could not delete the payment."));
        }
    };

    return (
        <div>
            {error && <div className={taxStyles.error}>{error}</div>}
            {message && <div className={`${taxStyles.banner} ${taxStyles.info}`} role="status">{message}</div>}

            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Total paid in FY {fy}</div>
                    <div className={styles.summaryValue}>{formatAmount(totalPaid)}</div>
                </div>
            </div>

            <div className={`${taxStyles.subsection}`}>
                <h3 className={taxStyles.subsectionTitle}>Instalments</h3>
                <p className={taxStyles.assumptions}>
                    A payment counts towards every instalment due on or after its payment date.
                </p>
                {instalments.length === 0 ? (
                    <div className={taxStyles.empty}><p>No instalment schedule is available for this year.</p></div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Due date</th>
                                    <th>Cumulative %</th>
                                    <th className={taxStyles.numeric}>Required by then</th>
                                    <th className={taxStyles.numeric}>Paid by then</th>
                                    <th className={taxStyles.numeric}>Shortfall</th>
                                </tr>
                            </thead>
                            <tbody>
                                {instalments.map((inst) => (
                                    <tr key={inst.dueDate}>
                                        <td>{formatDate(inst.dueDate)}</td>
                                        <td>{inst.cumulativePct}%</td>
                                        <td className={taxStyles.numeric}>{formatAmount(inst.required)}</td>
                                        <td className={taxStyles.numeric}>{formatAmount(inst.paid)}</td>
                                        <td className={taxStyles.numeric}>{formatAmount(inst.shortfall)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className={styles.actions} style={{ margin: "16px 0 12px" }}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setAdding((v) => !v)}>
                    {adding ? "Close" : "Record payment"}
                </button>
            </div>

            {adding && (
                <PaymentForm
                    fy={fy}
                    onCancel={() => setAdding(false)}
                    onSaved={async () => {
                        setAdding(false);
                        setMessage("Payment recorded.");
                        await refresh();
                    }}
                />
            )}

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Paid on</th>
                            <th className={taxStyles.numeric}>Amount</th>
                            <th>Type</th>
                            <th>Reference</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.length === 0 && (
                            <tr><td colSpan={5}>No payments recorded for FY {fy}.</td></tr>
                        )}
                        {payments.map((p) => (
                            <tr key={p.id}>
                                <td>{formatDate(p.paid_on)}</td>
                                <td className={taxStyles.numeric}>{formatAmount(p.amount)}</td>
                                <td>{KIND_LABEL[p.kind] || p.kind || "—"}</td>
                                <td>{p.reference || "—"}</td>
                                <td>
                                    <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                        onClick={() => handleDelete(p)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PaymentForm({ fy, onCancel, onSaved }) {
    const [form, setForm] = useState({ paid_on: "", amount: "", kind: "advance", reference: "" });
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const range = fyRange(fy);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!form.paid_on) return setFormError("Payment date is required.");
        if (form.paid_on < range.min || form.paid_on > range.max) {
            return setFormError(`Payment date must fall within FY ${fy} (${range.min} to ${range.max}).`);
        }
        const amount = toNumberOrNull(form.amount);
        if (amount === null || Number.isNaN(amount) || amount <= 0) {
            return setFormError("Amount must be a number greater than zero.");
        }

        setSaving(true);
        try {
            await window.electronAPI.tax.payments.add({
                fy,
                paid_on: form.paid_on,
                amount,
                kind: form.kind,
                reference: form.reference.trim() || null,
            });
            await onSaved();
        } catch (err) {
            setFormError(errorMessage(err, "Could not record the payment."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.fields} style={{ marginBottom: 16 }}>
            <h3 className={taxStyles.subsectionTitle} style={{ gridColumn: "1 / -1" }}>Record payment</h3>
            {formError && <div className={taxStyles.error} style={{ gridColumn: "1 / -1" }}>{formError}</div>}

            <div className={styles.field}>
                <label className={styles.label} htmlFor="pay-date">Paid on (in FY {fy})</label>
                <input id="pay-date" className={styles.input} type="date" min={range.min} max={range.max}
                    value={form.paid_on} onChange={(e) => set("paid_on", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="pay-amount">Amount (₹)</label>
                <input id="pay-amount" className={styles.input} type="number" min="1" step="1" value={form.amount}
                    onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="pay-kind">Type</label>
                <select id="pay-kind" className={styles.select} value={form.kind}
                    onChange={(e) => set("kind", e.target.value)}>
                    {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="pay-ref">Challan or reference (optional)</label>
                <input id="pay-ref" className={styles.input} value={form.reference}
                    onChange={(e) => set("reference", e.target.value)} />
            </div>

            <div className={styles.actions} style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? "Saving…" : "Record"}
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
