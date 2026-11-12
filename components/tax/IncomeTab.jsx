"use client";

import { useCallback, useEffect, useState } from "react";
import taxStyles from "./tax.module.css";
import { errorMessage, formatAmount, toNumberOrNull } from "./format";
import ImportDialog from "./ImportDialog";
import CapitalGainsTab from "./CapitalGainsTab";

const SECTION_TABS = [
    { id: "fd", label: "FD interest" },
    { id: "interest", label: "Savings & other interest" },
    { id: "dividends", label: "Dividends" },
    { id: "other", label: "Other income" },
    { id: "capital-gains", label: "Capital gains" },
];

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

function SummaryTile({ label, amount, total = false }) {
    return (
        <div className={`${taxStyles.incTile} ${total ? taxStyles.incTileTotal : ""}`}>
            <span className={taxStyles.incMetaLabel}>{label}</span>
            <span className={taxStyles.incTileValue}>{formatAmount(amount)}</span>
        </div>
    );
}

function IncomeCard({ title, description, accentClass, children }) {
    return (
        <section className={`${taxStyles.incCard} ${accentClass}`}>
            <div className={taxStyles.incCardHeader}>
                <div>
                    <h3 className={taxStyles.incCardTitle}>{title}</h3>
                    <p className={taxStyles.incCardDesc}>{description}</p>
                </div>
            </div>
            <div className={taxStyles.incCardBody}>{children}</div>
        </section>
    );
}

function TrashIcon() {
    return (
        <svg className={taxStyles.incIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
    );
}

function IconDeleteButton({ label, onClick }) {
    return (
        <button type="button" className={taxStyles.incIconBtn} title={label} aria-label={label} onClick={onClick}>
            <TrashIcon />
        </button>
    );
}

export default function IncomeTab({ fy, onOpenInvestments, exemption112A }) {
    const [activeSection, setActiveSection] = useState("fd");
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

    if (state.status === "loading") return <div className={taxStyles.empty}><p>Loading income…</p></div>;
    if (state.status === "error") return <div className={taxStyles.error}>{state.error}</div>;

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

    const fdTotal = fdRows
        .filter((fd) => !fd.missing)
        .reduce((sum, fd) => sum + (Number(overrideByInvestment.get(fd.investmentId)?.amount ?? fd.interest) || 0), 0);
    const interestTotal = interestRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const dividendTotal = dividends.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const grandTotal = fdTotal + interestTotal + dividendTotal;

    return (
        <div className={taxStyles.incomeRoot}>
            <header className={taxStyles.incHeader}>
                <div>
                    <h2 className={taxStyles.incTitle}>Other income</h2>
                    <p className={taxStyles.incSubtitle}>Interest and dividends for FY {fy}. Amounts in ₹.</p>
                </div>
                <button type="button" className={`${taxStyles.incBtn} ${taxStyles.incBtnSecondary}`} onClick={() => setImporting(true)}>
                    Import
                </button>
            </header>

            {error && <div className={`${taxStyles.incAlert} ${taxStyles.incAlertError}`} role="alert">{error}</div>}
            {message && <div className={`${taxStyles.incAlert} ${taxStyles.incAlertInfo}`} role="status">{message}</div>}

            <section className={taxStyles.incSummary} aria-label="FY income summary">
                <SummaryTile label="FD interest" amount={fdTotal} />
                <SummaryTile label="Savings and other interest" amount={interestTotal} />
                <SummaryTile label="Dividends recorded" amount={dividendTotal} />
                <SummaryTile label="Total for FY" amount={grandTotal} total />
            </section>

            <div className={taxStyles.incTabs} role="tablist" aria-label="Other income sections">
                {SECTION_TABS.map((tab) => {
                    const count = {
                        fd: fdRows.length,
                        interest: interestRows.length,
                        dividends: dividends.length,
                        other: otherRows.length,
                    }[tab.id];
                    const selected = activeSection === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`inc-tab-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls="inc-tabpanel"
                            className={`${taxStyles.incTab} ${selected ? taxStyles.incTabActive : ""}`}
                            onClick={() => setActiveSection(tab.id)}
                        >
                            {tab.label}
                            {count !== undefined && count > 0 && <span className={taxStyles.incBadge}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            <div id="inc-tabpanel" role="tabpanel" aria-labelledby={`inc-tab-${activeSection}`}>
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

            {activeSection === "fd" && (
            <FdSection
                rows={fdRows}
                onOpenInvestments={onOpenInvestments}
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
            )}

            {activeSection === "interest" && (
            <InterestRowsSection
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
            )}

            {activeSection === "dividends" && (
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
            )}

            {activeSection === "other" && (
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
            )}

            {activeSection === "capital-gains" && (
                <CapitalGainsTab fy={fy} exemption={exemption112A} />
            )}
            </div>
        </div>
    );
}

function FdSection({ rows, overrideByInvestment, fy, onOpenInvestments, onAddOverride, onUpdateOverride, onRemoveOverride }) {
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
        <IncomeCard
            title={`Fixed deposit interest (FY ${fy})`}
            description="Interest from your active FDs on the Investments page. Override the automatic figure if your bank statement differs."
            accentClass={taxStyles.accentTeal}
        >
            {rows.some((fd) => fd.missing) && (
                <div className={`${taxStyles.incAlert} ${taxStyles.incAlertWarning}`} role="alert">
                    <span>
                        Some FDs have no interest rate, so they are left out of the total.
                        Add the rate on the Investments page.
                    </span>
                </div>
            )}

            {rows.length === 0 ? (
                <div className={taxStyles.incEmpty}>
                    <p className={taxStyles.incEmptyTitle}>No active FDs for FY {fy}</p>
                    <p className={taxStyles.incHint}>FDs added on the Investments page appear here automatically.</p>
                </div>
            ) : (
                <div className={taxStyles.incTableWrap}>
                    <table className={taxStyles.incTable}>
                        <thead>
                            <tr>
                                <th>FD</th>
                                <th>Source</th>
                                <th className={taxStyles.incNum}>Interest for FY</th>
                                <th><span className={taxStyles.incSrOnly}>Actions</span></th>
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
                                                <span className={`${taxStyles.incStatus} ${taxStyles.incStatusInfo}`}>Override</span>
                                            ) : fd.missing ? (
                                                <span className={`${taxStyles.incStatus} ${taxStyles.incStatusWarn}`}>Rate missing</span>
                                            ) : (
                                                <span className={taxStyles.incMuted}>Automatic</span>
                                            )}
                                        </td>
                                        <td className={taxStyles.incNum}>
                                            {fd.missing ? "—" : formatAmount(override ? override.amount : fd.interest)}
                                        </td>
                                        <td className={taxStyles.incActions}>
                                            {fd.missing ? (
                                                <button type="button" className={`${taxStyles.incBtn} ${taxStyles.incBtnPrimary} ${taxStyles.incBtnSm}`}
                                                    onClick={onOpenInvestments} disabled={!onOpenInvestments}>
                                                    Set rate
                                                </button>
                                            ) : (
                                                <div className={taxStyles.incBtnGroup}>
                                                    <button type="button" className={`${taxStyles.incBtn} ${taxStyles.incBtnSecondary} ${taxStyles.incBtnSm}`}
                                                        onClick={() => startEdit(fd, override)}>
                                                        {override ? "Edit" : "Override"}
                                                    </button>
                                                    {override && (
                                                        <IconDeleteButton label="Remove override" onClick={() => onRemoveOverride(override)} />
                                                    )}
                                                </div>
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
                <form onSubmit={submit} className={taxStyles.incForm} noValidate>
                    <div className={taxStyles.incField}>
                        <label className={taxStyles.incLabel} htmlFor="fd-override-amount">
                            Interest for {editing.name} (₹)
                        </label>
                        <input id="fd-override-amount" className={taxStyles.incInput} type="number" min="0" step="1"
                            value={amount} onChange={(e) => setAmount(e.target.value)}
                            aria-invalid={formError ? "true" : undefined}
                            aria-describedby={formError ? "fd-override-error" : undefined} />
                        {formError && <span id="fd-override-error" className={taxStyles.incFieldError}>{formError}</span>}
                    </div>
                    <div className={taxStyles.incBtnGroup}>
                        <button type="submit" className={`${taxStyles.incBtn} ${taxStyles.incBtnPrimary}`}>Save override</button>
                        <button type="button" className={`${taxStyles.incBtn} ${taxStyles.incBtnSecondary}`} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                </form>
            )}
        </IncomeCard>
    );
}

function InterestRowsSection({ rows, onAdd, onRemove }) {
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

    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return (
        <IncomeCard
            title="Savings and other interest"
            description="Interest from savings accounts and other deposits that is not from an FD."
            accentClass={taxStyles.accentBlue}
        >
            <form onSubmit={submit} className={`${taxStyles.incForm} ${taxStyles.incFormCols3}`} noValidate>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="interest-kind">Type</label>
                    <select id="interest-kind" className={taxStyles.incInput} value={form.kind}
                        onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                        {INTEREST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                </div>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="interest-label">Label</label>
                    <input id="interest-label" className={taxStyles.incInput} value={form.label} placeholder="e.g. HDFC savings"
                        onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="interest-amount">Amount (₹)</label>
                    <input id="interest-amount" className={taxStyles.incInput} type="number" min="0" step="1" value={form.amount}
                        placeholder="0"
                        aria-invalid={formError ? "true" : undefined}
                        aria-describedby={formError ? "interest-error" : undefined}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    {formError && <span id="interest-error" className={taxStyles.incFieldError}>{formError}</span>}
                </div>
                <div className={taxStyles.incFormAction}>
                    <button type="submit" className={`${taxStyles.incBtn} ${taxStyles.incBtnPrimary}`}>Add interest</button>
                </div>
            </form>

            <SourceTable rows={rows} labelFor={(r) => INTEREST_KINDS.find((k) => k.value === r.kind)?.label}
                emptyTitle="No savings or other interest yet" emptyHint="Add your first entry above."
                onRemove={onRemove} />
            {rows.length > 0 && (
                <div className={taxStyles.incTotal}>
                    <span>Subtotal</span>
                    <span className={taxStyles.incNum}>{formatAmount(total)}</span>
                </div>
            )}
        </IncomeCard>
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
    const forecastValue = forecastRow ? Number(forecastRow.amount) || 0 : null;

    return (
        <IncomeCard
            title="Dividends"
            description="Dividends from shares and mutual funds. Recorded entries are used in the tax calculation."
            accentClass={taxStyles.accentGreen}
        >
            <form onSubmit={submitHistory} className={`${taxStyles.incForm} ${taxStyles.incFormCols2}`} noValidate>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="div-source">Company or fund</label>
                    <input id="div-source" className={taxStyles.incInput} value={form.source_label} placeholder="e.g. Infosys"
                        aria-invalid={formError && !form.source_label.trim() ? "true" : undefined}
                        onChange={(e) => setForm({ ...form, source_label: e.target.value })} />
                </div>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="div-amount">Amount (₹)</label>
                    <input id="div-amount" className={taxStyles.incInput} type="number" min="0" step="1" value={form.amount}
                        placeholder="0"
                        aria-invalid={formError ? "true" : undefined}
                        aria-describedby={formError ? "div-error" : undefined}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    {formError && <span id="div-error" className={taxStyles.incFieldError}>{formError}</span>}
                </div>
                <div className={taxStyles.incFormAction}>
                    <button type="submit" className={`${taxStyles.incBtn} ${taxStyles.incBtnPrimary}`}>Add dividend</button>
                </div>
            </form>

            <div className={taxStyles.incTableWrap}>
                <table className={taxStyles.incTable}>
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th className={taxStyles.incNum}>Amount</th>
                            <th><span className={taxStyles.incSrOnly}>Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 && (
                            <tr>
                                <td colSpan={3}>
                                    <div className={taxStyles.incEmpty}>
                                        <p className={taxStyles.incEmptyTitle}>No dividends recorded for FY {fy}</p>
                                        <p className={taxStyles.incHint}>Add your first dividend above.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {history.map((row) => (
                            <tr key={row.id}>
                                <td>{row.source_label}</td>
                                <td className={taxStyles.incNum}>{formatAmount(row.amount)}</td>
                                <td className={taxStyles.incActions}>
                                    <IconDeleteButton label={`Delete ${row.source_label}`} onClick={() => onRemoveHistory(row)} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {history.length > 0 && (
                <div className={taxStyles.incTotal}>
                    <span>Total recorded</span>
                    <span className={taxStyles.incNum}>{formatAmount(total)}</span>
                </div>
            )}

            <div className={taxStyles.incForecast}>
                <div className={taxStyles.incForecastHead}>
                    <strong>Dividend forecast for FY {fy}</strong>
                    <span className={taxStyles.incTagEstimate}>Estimate</span>
                </div>
                <form onSubmit={submitForecast} className={taxStyles.incForm} noValidate>
                    <div className={taxStyles.incField}>
                        <label className={taxStyles.incLabel} htmlFor="div-forecast">Estimated amount (₹)</label>
                        <input id="div-forecast" className={taxStyles.incInput} type="number" min="0" step="1" value={forecast}
                            aria-invalid={forecastError ? "true" : undefined}
                            aria-describedby={forecastError ? "forecast-error" : "forecast-hint"}
                            onChange={(e) => setForecast(e.target.value)} />
                        {forecastError
                            ? <span id="forecast-error" className={taxStyles.incFieldError}>{forecastError}</span>
                            : <span id="forecast-hint" className={taxStyles.incHint}>
                                {suggestedForecast != null
                                    ? `Suggested: ${formatAmount(suggestedForecast)}, the average of past years.`
                                    : "No past years to average. Enter a value."}
                            </span>}
                    </div>
                    <div className={taxStyles.incFormAction}>
                        <button type="submit" className={`${taxStyles.incBtn} ${taxStyles.incBtnSecondary}`}>
                            {forecastRow ? "Update forecast" : "Save forecast"}
                        </button>
                    </div>
                </form>
                <div className={taxStyles.incCompare}>
                    <div className={taxStyles.incStat}>
                        <span className={taxStyles.incMetaLabel}>Recorded</span>
                        <span className={taxStyles.incStatValue}>{formatAmount(total)}</span>
                    </div>
                    <div className={taxStyles.incStat}>
                        <span className={taxStyles.incMetaLabel}>Forecast</span>
                        <span className={taxStyles.incStatValue}>{forecastValue != null ? formatAmount(forecastValue) : "Not set"}</span>
                    </div>
                </div>
                <p className={taxStyles.incHint}>
                    The tax calculation uses recorded dividends when any are entered. The forecast is used only when none are
                    recorded and &ldquo;Forecast dividends&rdquo; is enabled in your tax profile.
                </p>
            </div>
        </IncomeCard>
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

    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return (
        <IncomeCard
            title="Other income"
            description="Recorded for reference only. This is not included in the tax calculation."
            accentClass={taxStyles.accentSlate}
        >
            <form onSubmit={submit} className={`${taxStyles.incForm} ${taxStyles.incFormCols2}`} noValidate>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="other-label">Description</label>
                    <input id="other-label" className={taxStyles.incInput} value={form.label} placeholder="e.g. Gift received"
                        aria-invalid={formError && !form.label.trim() ? "true" : undefined}
                        onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div className={taxStyles.incField}>
                    <label className={taxStyles.incLabel} htmlFor="other-amount">Amount (₹)</label>
                    <input id="other-amount" className={taxStyles.incInput} type="number" min="0" step="1" value={form.amount}
                        placeholder="0"
                        aria-invalid={formError ? "true" : undefined}
                        aria-describedby={formError ? "other-error" : undefined}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    {formError && <span id="other-error" className={taxStyles.incFieldError}>{formError}</span>}
                </div>
                <div className={taxStyles.incFormAction}>
                    <button type="submit" className={`${taxStyles.incBtn} ${taxStyles.incBtnPrimary}`}>Add other income</button>
                </div>
            </form>

            <SourceTable rows={rows} labelFor={() => "Other"}
                emptyTitle="No other income recorded" emptyHint="Add your first entry above."
                onRemove={onRemove} />
            {rows.length > 0 && (
                <div className={taxStyles.incTotal}>
                    <span>Subtotal</span>
                    <span className={taxStyles.incNum}>{formatAmount(total)}</span>
                </div>
            )}
        </IncomeCard>
    );
}

function SourceTable({ rows, labelFor, emptyTitle, emptyHint, onRemove }) {
    if (rows.length === 0) {
        return (
            <div className={taxStyles.incEmpty}>
                <p className={taxStyles.incEmptyTitle}>{emptyTitle}</p>
                <p className={taxStyles.incHint}>{emptyHint}</p>
            </div>
        );
    }
    return (
        <div className={taxStyles.incTableWrap}>
            <table className={taxStyles.incTable}>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Label</th>
                        <th className={taxStyles.incNum}>Amount</th>
                        <th><span className={taxStyles.incSrOnly}>Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td>{labelFor(row)}</td>
                            <td>{row.label || "—"}</td>
                            <td className={taxStyles.incNum}>{formatAmount(row.amount)}</td>
                            <td className={taxStyles.incActions}>
                                <IconDeleteButton label={`Delete ${row.label || labelFor(row)}`} onClick={() => onRemove(row)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}