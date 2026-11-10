"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import { errorMessage, formatAmount, toNumberOrNull } from "./format";
import ImportDialog from "./ImportDialog";

const INTEREST_KINDS = [
    { value: "interest_savings", label: "Savings account interest" },
    { value: "interest_deposit", label: "Other deposit interest (non-FD)" },
    { value: "interest_other", label: "Other interest" },
];

const FORECAST_LABEL = "Dividend forecast";

function average(values) {
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export default function IncomeTab({ fy }) {
    const [state, setState] = useState({ status: "loading", error: "" });
    const [overview, setOverview] = useState(null);
    const [sources, setSources] = useState([]);
    const [dividends, setDividends] = useState([]);
    const [pastDividendTotals, setPastDividendTotals] = useState([]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [importing, setImporting] = useState(false);

    const fetchAll = useCallback(async () => {
        const years = await window.electronAPI.tax.financialYears();
        const pastYears = years.filter((y) => y < fy);
        const [ov, srcs, divs, pastLists] = await Promise.all([
            window.electronAPI.tax.getOverview(fy),
            window.electronAPI.tax.incomeSources.list(fy),
            window.electronAPI.tax.dividendHistory.list(fy),
            Promise.all(pastYears.map((y) => window.electronAPI.tax.dividendHistory.list(y))),
        ]);
        return {
            ov,
            srcs,
            divs,
            pastTotals: pastLists.map((rows) => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)),
        };
    }, [fy]);

    const applyData = useCallback((data) => {
        setOverview(data.ov);
        setSources(data.srcs);
        setDividends(data.divs);
        setPastDividendTotals(data.pastTotals);
    }, []);

    const load = useCallback(async () => applyData(await fetchAll()), [fetchAll, applyData]);

    useEffect(() => {
        let active = true;
        fetchAll()
            .then((data) => {
                if (!active) return;
                applyData(data);
                setState({ status: "ready", error: "" });
            })
            .catch((err) => active && setState({ status: "error", error: errorMessage(err, "Could not load income.") }));
        return () => {
            active = false;
        };
    }, [fetchAll, applyData]);

    const run = async (action, success) => {
        setError("");
        setMessage("");
        try {
            await action();
            setMessage(success);
            await load();
        } catch (err) {
            setError(errorMessage(err, "Something went wrong."));
        }
    };

    if (state.status === "loading") return <div className={styles.empty}><p>Loading income…</p></div>;
    if (state.status === "error") return <div className={styles.error}>{state.error}</div>;

    const overrides = sources.filter((s) => s.is_override);
    const overrideByInvestment = new Map(overrides.map((s) => [s.investment_id, s]));
    const interestRows = sources.filter((s) => !s.is_override && INTEREST_KINDS.some((k) => k.value === s.kind));
    const otherRows = sources.filter((s) => !s.is_override && s.kind === "other");
    const forecastRow = sources.find((s) => s.kind === "dividend" && s.label === FORECAST_LABEL) || null;
    const suggestedForecast = average(pastDividendTotals);

    const fdRows = [
        ...(overview?.fdInterest || []).map((fd) => ({ ...fd, missing: false })),
        ...(overview?.fdMissingRate || []).map((fd) => ({ ...fd, interest: null, source: null, missing: true })),
    ];

    return (
        <div>
            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={`${taxStyles.banner} ${taxStyles.info}`} role="status">{message}</div>}

            <div className={styles.actions} style={{ margin: "12px 0" }}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setImporting(true)}>
                    Import
                </button>
            </div>

            {importing && (
                <ImportDialog
                    kind="income"
                    fy={fy}
                    onClose={() => setImporting(false)}
                    onImported={async (text) => {
                        setImporting(false);
                        setError("");
                        setMessage(text);
                        await load();
                    }}
                />
            )}

            <FdSection
                rows={fdRows}
                overrideByInvestment={overrideByInvestment}
                fy={fy}
                onAddOverride={(fd, amount) =>
                    run(
                        () => window.electronAPI.tax.incomeSources.add({
                            fy,
                            kind: "interest_deposit",
                            label: fd.name,
                            amount,
                            investment_id: fd.investmentId,
                            is_override: true,
                        }),
                        `Override saved for ${fd.name}.`,
                    )
                }
                onUpdateOverride={(source, amount) =>
                    run(
                        () => window.electronAPI.tax.incomeSources.update({ id: source.id, amount }),
                        "Override updated.",
                    )
                }
                onRemoveOverride={(source) => {
                    if (!confirm("Remove this override? The automatic FD interest will be used again.")) return;
                    run(() => window.electronAPI.tax.incomeSources.remove(source.id), "Override removed.");
                }}
            />

            <InterestRowsSection
                title="Savings and other interest"
                rows={interestRows}
                onAdd={(form) =>
                    run(
                        () => window.electronAPI.tax.incomeSources.add({ fy, ...form }),
                        "Interest row added.",
                    )
                }
                onRemove={(row) => {
                    if (!confirm(`Delete "${row.label || "this interest row"}"?`)) return;
                    run(() => window.electronAPI.tax.incomeSources.remove(row.id), "Interest row deleted.");
                }}
            />

            <DividendSection
                fy={fy}
                history={dividends}
                suggestedForecast={suggestedForecast}
                forecastRow={forecastRow}
                onAddHistory={(form) =>
                    run(() => window.electronAPI.tax.dividendHistory.add({ fy, ...form }), "Dividend added.")
                }
                onRemoveHistory={(row) => {
                    if (!confirm(`Delete dividend "${row.source_label}"?`)) return;
                    run(() => window.electronAPI.tax.dividendHistory.remove(row.id), "Dividend deleted.");
                }}
                onSaveForecast={(amount) => {
                    const action = forecastRow
                        ? () => window.electronAPI.tax.incomeSources.update({ id: forecastRow.id, amount })
                        : () => window.electronAPI.tax.incomeSources.add({
                            fy,
                            kind: "dividend",
                            label: FORECAST_LABEL,
                            amount,
                            is_override: false,
                        });
                    return run(action, "Dividend forecast saved.");
                }}
            />

            <OtherIncomeSection
                rows={otherRows}
                onAdd={(form) =>
                    run(
                        () => window.electronAPI.tax.incomeSources.add({ fy, kind: "other", ...form }),
                        "Other income added.",
                    )
                }
                onRemove={(row) => {
                    if (!confirm(`Delete "${row.label || "this income"}"?`)) return;
                    run(() => window.electronAPI.tax.incomeSources.remove(row.id), "Other income deleted.");
                }}
            />
        </div>
    );
}

function FdSection({ rows, overrideByInvestment, fy, onAddOverride, onUpdateOverride, onRemoveOverride }) {
    const [editing, setEditing] = useState(null);
    const [amount, setAmount] = useState("");
    const [formError, setFormError] = useState("");

    const startEdit = (fd, existing) => {
        setEditing({ investmentId: fd.investmentId, existingId: existing?.id ?? null, name: fd.name, source: existing });
        setAmount(existing ? String(existing.amount) : "");
        setFormError("");
    };

    const submit = (e) => {
        e.preventDefault();
        const n = toNumberOrNull(amount);
        if (n === null || Number.isNaN(n) || n < 0) return setFormError("Enter a zero or positive amount.");
        if (editing.source) onUpdateOverride(editing.source, n);
        else onAddOverride({ name: editing.name, investmentId: editing.investmentId }, n);
        setEditing(null);
    };

    return (
        <div className={taxStyles.subsection}>
            <h3 className={taxStyles.subsectionTitle}>Fixed deposit interest (FY {fy})</h3>
            {rows.length === 0 ? (
                <p className={taxStyles.assumptions}>No active FDs found in Investments for this year.</p>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>FD</th>
                                <th>Source</th>
                                <th className={taxStyles.numeric}>Interest for FY</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((fd) => {
                                const override = overrideByInvestment.get(fd.investmentId) || null;
                                return (
                                    <tr key={fd.investmentId}>
                                        <td>{fd.name}</td>
                                        <td>
                                            {override ? (
                                                <span className={`${taxStyles.banner} ${taxStyles.warning}`}>Override</span>
                                            ) : fd.missing ? (
                                                <span className={taxStyles.assumptions}>Rate missing: set it on the Investments page</span>
                                            ) : (
                                                "Automatic"
                                            )}
                                        </td>
                                        <td className={taxStyles.numeric}>
                                            {formatAmount(override ? override.amount : fd.interest)}
                                        </td>
                                        <td>
                                            {!fd.missing && (
                                                <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                    onClick={() => startEdit(fd, override)}>
                                                    {override ? "Edit override" : "Override"}
                                                </button>
                                            )}
                                            {override && (
                                                <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                    onClick={() => onRemoveOverride(override)}>
                                                    Remove override
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <form onSubmit={submit} className={styles.fields} style={{ marginTop: 12 }}>
                    {formError && <div className={styles.error}>{formError}</div>}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="fd-override-amount">
                            Interest for {editing.name} (₹), replaces the automatic figure
                        </label>
                        <input id="fd-override-amount" className={styles.input} type="number" min="0" step="1"
                            value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <div className={styles.actions}>
                        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Save override</button>
                        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                </form>
            )}
        </div>
    );
}

function InterestRowsSection({ title, rows, onAdd, onRemove }) {
    const [form, setForm] = useState({ kind: INTEREST_KINDS[0].value, label: "", amount: "" });
    const [formError, setFormError] = useState("");

    const submit = (e) => {
        e.preventDefault();
        const n = toNumberOrNull(form.amount);
        if (n === null || Number.isNaN(n) || n < 0) return setFormError("Enter a zero or positive amount.");
        setFormError("");
        onAdd({ kind: form.kind, label: form.label.trim() || null, amount: n, is_override: false });
        setForm({ ...form, label: "", amount: "" });
    };

    return (
        <div className={taxStyles.subsection}>
            <h3 className={taxStyles.subsectionTitle}>{title}</h3>
            <SourceTable rows={rows} labelFor={(r) => INTEREST_KINDS.find((k) => k.value === r.kind)?.label} onRemove={onRemove} />
            <form onSubmit={submit} className={styles.fields} style={{ marginTop: 12 }}>
                {formError && <div className={styles.error}>{formError}</div>}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="interest-kind">Type</label>
                    <select id="interest-kind" className={styles.select} value={form.kind}
                        onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                        {INTEREST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="interest-label">Label</label>
                    <input id="interest-label" className={styles.input} value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="interest-amount">Amount (₹)</label>
                    <input id="interest-amount" className={styles.input} type="number" min="0" step="1" value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className={styles.actions}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Add interest</button>
                </div>
            </form>
        </div>
    );
}

function DividendSection({ fy, history, suggestedForecast, forecastRow, onAddHistory, onRemoveHistory, onSaveForecast }) {
    const [form, setForm] = useState({ source_label: "", amount: "" });
    const [formError, setFormError] = useState("");
    const [forecast, setForecast] = useState(() =>
        forecastRow ? String(forecastRow.amount) : suggestedForecast != null ? String(suggestedForecast) : "",
    );
    const [forecastError, setForecastError] = useState("");

    const submitHistory = (e) => {
        e.preventDefault();
        const n = toNumberOrNull(form.amount);
        if (!form.source_label.trim()) return setFormError("Enter the company or fund name.");
        if (n === null || Number.isNaN(n) || n < 0) return setFormError("Enter a zero or positive amount.");
        setFormError("");
        onAddHistory({ source_label: form.source_label.trim(), amount: n });
        setForm({ source_label: "", amount: "" });
    };

    const submitForecast = (e) => {
        e.preventDefault();
        const n = toNumberOrNull(forecast);
        if (n === null || Number.isNaN(n) || n < 0) return setForecastError("Enter a zero or positive amount.");
        setForecastError("");
        onSaveForecast(n);
    };

    const total = history.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return (
        <div className={taxStyles.subsection}>
            <h3 className={taxStyles.subsectionTitle}>Dividends</h3>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th className={taxStyles.numeric}>Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 && (
                            <tr><td colSpan={3}>No dividends recorded for FY {fy}.</td></tr>
                        )}
                        {history.map((row) => (
                            <tr key={row.id}>
                                <td>{row.source_label}</td>
                                <td className={taxStyles.numeric}>{formatAmount(row.amount)}</td>
                                <td>
                                    <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                        onClick={() => onRemoveHistory(row)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        <tr className={taxStyles.totalRow}>
                            <td>Total recorded</td>
                            <td className={taxStyles.numeric}>{formatAmount(total)}</td>
                            <td />
                        </tr>
                    </tbody>
                </table>
            </div>

            <form onSubmit={submitHistory} className={styles.fields} style={{ marginTop: 12 }}>
                {formError && <div className={styles.error}>{formError}</div>}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="div-source">Company or fund</label>
                    <input id="div-source" className={styles.input} value={form.source_label}
                        onChange={(e) => setForm({ ...form, source_label: e.target.value })} />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="div-amount">Amount (₹)</label>
                    <input id="div-amount" className={styles.input} type="number" min="0" step="1" value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className={styles.actions}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Add dividend</button>
                </div>
            </form>

            <form onSubmit={submitForecast} className={styles.fields} style={{ marginTop: 16 }}>
                {forecastError && <div className={styles.error}>{forecastError}</div>}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="div-forecast">
                        Dividend forecast for FY {fy} (₹)
                    </label>
                    <input id="div-forecast" className={styles.input} type="number" min="0" step="1" value={forecast}
                        onChange={(e) => setForecast(e.target.value)} />
                    <span className={taxStyles.assumptions}>
                        {suggestedForecast != null
                            ? `Suggested: ${formatAmount(suggestedForecast)}, the average of past years.`
                            : "No past years to average. Enter a value."}
                    </span>
                </div>
                <div className={styles.actions}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                        {forecastRow ? "Update forecast" : "Save forecast"}
                    </button>
                </div>
            </form>
            <p className={taxStyles.assumptions}>
                The forecast is the amount used in the tax calculation. The recorded list above is for reference only.
            </p>
        </div>
    );
}

function OtherIncomeSection({ rows, onAdd, onRemove }) {
    const [form, setForm] = useState({ label: "", amount: "" });
    const [formError, setFormError] = useState("");

    const submit = (e) => {
        e.preventDefault();
        const n = toNumberOrNull(form.amount);
        if (!form.label.trim()) return setFormError("Enter a description.");
        if (n === null || Number.isNaN(n) || n < 0) return setFormError("Enter a zero or positive amount.");
        setFormError("");
        onAdd({ label: form.label.trim(), amount: n, is_override: false });
        setForm({ label: "", amount: "" });
    };

    return (
        <div className={taxStyles.subsection}>
            <h3 className={taxStyles.subsectionTitle}>Other income</h3>
            <p className={taxStyles.assumptions}>
                Other income is recorded for reference. It is not included in the tax calculation.
            </p>
            <SourceTable rows={rows} labelFor={() => "Other"} onRemove={onRemove} />
            <form onSubmit={submit} className={styles.fields} style={{ marginTop: 12 }}>
                {formError && <div className={styles.error}>{formError}</div>}
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="other-label">Description</label>
                    <input id="other-label" className={styles.input} value={form.label}
                        onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="other-amount">Amount (₹)</label>
                    <input id="other-amount" className={styles.input} type="number" min="0" step="1" value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className={styles.actions}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Add other income</button>
                </div>
            </form>
        </div>
    );
}

function SourceTable({ rows, labelFor, onRemove }) {
    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Label</th>
                        <th className={taxStyles.numeric}>Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={4}>No entries yet.</td></tr>}
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td>{labelFor(row)}</td>
                            <td>{row.label || "—"}</td>
                            <td className={taxStyles.numeric}>{formatAmount(row.amount)}</td>
                            <td>
                                <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                    onClick={() => onRemove(row)}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
