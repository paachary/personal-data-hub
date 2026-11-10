"use client";

import { useEffect, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";

const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

function formatAmount(value) {
    return typeof value === "number" ? inr.format(value) : "—";
}

function formatDate(isoDate) {
    if (!isoDate) return "—";
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

const REGIME_ROWS = [
    ["Gross total income", (r) => r.grossTotalIncome?.total],
    ["Deductions", (r) => r.deductions?.total],
    ["Taxable income", (r) => r.taxableIncome?.total],
    ["Tax on slabs", (r) => r.slabTax],
    ["Rebate u/s 87A", (r) => r.rebate87A?.rebate],
    ["Special-rate tax (capital gains)", (r) => r.specialTax?.total],
    ["Surcharge", (r) => r.surcharge],
    ["Health & education cess", (r) => r.cess?.amount],
    ["Total tax", (r) => r.totalTax],
];

function isEmptyOverview(data) {
    const hasIncome = Object.values(data.incomeTotals).some((v) => typeof v === "number" && v > 0);
    return !data.profileSaved && !hasIncome && data.payments.length === 0 && data.capitalGains.length === 0;
}

export default function OverviewTab({ fy }) {
    const [state, setState] = useState({ status: "loading", data: null, error: null });

    useEffect(() => {
        let active = true;
        window.electronAPI.tax
            .getOverview(fy)
            .then((data) => {
                if (active) setState({ status: "ready", data, error: null });
            })
            .catch((err) => {
                if (active) setState({ status: "error", data: null, error: err?.message || "Failed to load tax overview." });
            });
        return () => {
            active = false;
        };
    }, [fy]);

    if (state.status === "loading") {
        return <div className={styles.empty}><p>Loading tax overview…</p></div>;
    }

    if (state.status === "error") {
        return <div className={styles.error}>{state.error}</div>;
    }

    const data = state.data;

    if (isEmptyOverview(data)) {
        return (
            <div className={styles.empty}>
                <p>No tax data for FY {fy} yet.</p>
                <p>Save your tax profile and add income, payments or gains to see an estimate.</p>
            </div>
        );
    }

    const { tax, schedule, recommendedRegime, notes } = data;
    const saving = tax.saving;
    const regimeKeys = Object.keys(tax.regimes);
    const chosen = tax.regimes[recommendedRegime];
    const instalments = schedule.instalments;
    const chartData = instalments.map((i) => ({
        name: formatDate(i.dueDate),
        Required: i.required,
        Paid: i.paid,
    }));

    return (
        <div>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Recommended regime</div>
                    <div className={styles.summaryValue}>
                        {recommendedRegime ? `${recommendedRegime} regime` : "—"}
                    </div>
                    {regimeKeys.length > 1 && (
                        <div className={styles.summaryChange}>Saves {formatAmount(saving)}</div>
                    )}
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Total tax liability</div>
                    <div className={styles.summaryValue}>{formatAmount(data.netTax)}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>TDS / TCS credited</div>
                    <div className={styles.summaryValue}>{formatAmount(chosen?.tdsTcs)}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Net payable</div>
                    <div className={styles.summaryValue}>{formatAmount(schedule.advanceTaxPayable)}</div>
                </div>
            </div>

            <div className={taxStyles.subsection}>
                <h3 className={taxStyles.subsectionTitle}>Old vs new regime</h3>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Item</th>
                                {regimeKeys.map((key) => (
                                    <th key={key} className={taxStyles.numeric}>
                                        {key === "old" ? "Old regime" : "New regime"}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {REGIME_ROWS.map(([label, pick]) => (
                                <tr key={label} className={label === "Total tax" ? taxStyles.totalRow : undefined}>
                                    <td>{label}</td>
                                    {regimeKeys.map((key) => (
                                        <td key={key} className={taxStyles.numeric}>
                                            {formatAmount(pick(tax.regimes[key]))}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {schedule.applicable ? (
                <>
                    <div className={taxStyles.subsection}>
                        <h3 className={taxStyles.subsectionTitle}>Advance tax instalments</h3>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Due date</th>
                                        <th className={taxStyles.numeric}>Cumulative %</th>
                                        <th className={taxStyles.numeric}>Required</th>
                                        <th className={taxStyles.numeric}>Paid</th>
                                        <th className={taxStyles.numeric}>Shortfall</th>
                                        <th className={taxStyles.numeric}>234C interest</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {instalments.map((i) => (
                                        <tr key={i.dueDate}>
                                            <td>{formatDate(i.dueDate)}</td>
                                            <td className={taxStyles.numeric}>{i.cumulativePct}%</td>
                                            <td className={taxStyles.numeric}>{formatAmount(i.required)}</td>
                                            <td className={taxStyles.numeric}>{formatAmount(i.paid)}</td>
                                            <td className={taxStyles.numeric}>{formatAmount(i.shortfall)}</td>
                                            <td className={taxStyles.numeric}>{formatAmount(i.interest234C?.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className={taxStyles.totalRow}>
                                        <td>Total</td>
                                        <td />
                                        <td className={taxStyles.numeric}>{formatAmount(schedule.totals.required)}</td>
                                        <td className={taxStyles.numeric}>{formatAmount(schedule.totals.paid)}</td>
                                        <td className={taxStyles.numeric}>{formatAmount(schedule.totals.shortfallAtYearEnd)}</td>
                                        <td className={taxStyles.numeric}>{formatAmount(schedule.totals.interest234C)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={taxStyles.subsection}>
                        <h3 className={taxStyles.subsectionTitle}>Interest u/s 234B (estimate)</h3>
                        {schedule.interest234B.applicable ? (
                            <p>
                                Shortfall of {formatAmount(schedule.interest234B.shortfall)} for{" "}
                                {schedule.interest234B.months} months: {formatAmount(schedule.interest234B.amount)}.
                            </p>
                        ) : (
                            <p>No 234B interest expected on the estimate.</p>
                        )}
                    </div>

                    <div className={taxStyles.subsection}>
                        <h3 className={taxStyles.subsectionTitle}>Required vs paid</h3>
                        <div className={taxStyles.chartBox}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={(v) => inr.format(v)} width={110} />
                                    <Tooltip formatter={(v) => inr.format(v)} />
                                    <Legend />
                                    <Bar dataKey="Required" fill="#4f7cd6" />
                                    <Bar dataKey="Paid" fill="#2fa572" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <div className={`${taxStyles.banner} ${taxStyles.info}`}>
                    {schedule.reason}
                </div>
            )}

            {data.profile?.presumptive_44ad ? (
                <div className={`${taxStyles.banner} ${taxStyles.info}`}>
                    Presumptive business income (44AD): the full tax is due in one instalment on 15 March.
                </div>
            ) : null}

            {notes?.length > 0 && (
                <div className={taxStyles.subsection}>
                    <h3 className={taxStyles.subsectionTitle}>Assumptions</h3>
                    <ul className={taxStyles.assumptions}>
                        {notes.map((note) => (
                            <li key={note}>{note}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
