"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "@/components/finance/finance.module.css";
import fStyles from "@/components/finance/filter.module.css";
import rStyles from "./report.module.css";

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

function MultiSelect({ label, options, selected, onChange }) {
    const toggle = (val) =>
        onChange(
            selected.includes(val)
                ? selected.filter((v) => v !== val)
                : [...selected, val]
        );
    return (
        <div className={fStyles.filterBar}>
            <span className={fStyles.filterLabel}>{label}</span>
            <div className={fStyles.chips}>
                {options.map((opt) => (
                    <button
                        key={opt}
                        className={`${fStyles.chip} ${
                            selected.includes(opt) ? fStyles.chipActive : ""
                        }`}
                        onClick={() => toggle(opt)}
                    >
                        {opt}
                    </button>
                ))}
                {selected.length > 0 && (
                    <button
                        className={fStyles.chipClear}
                        onClick={() => onChange([])}
                    >
                        ✕ Clear
                    </button>
                )}
            </div>
        </div>
    );
}

function InvestmentReportTable({ data }) {
    const [selUsers, setSelUsers] = useState([]);
    const [selInstruments, setSelInstruments] = useState([]);
    const [selTypes, setSelTypes] = useState([]);

    const userOptions = [...new Set(data.map((i) => i.username))];
    const instrumentOptions = [...new Set(data.map((i) => i.instrument_code))];
    const typeOptions = [...new Set(data.map((i) => i.investment_type_code))];

    const filtered = useMemo(() => {
        return data.filter((i) => {
            if (selUsers.length > 0 && !selUsers.includes(i.username))
                return false;
            if (
                selInstruments.length > 0 &&
                !selInstruments.includes(i.instrument_code)
            )
                return false;
            if (
                selTypes.length > 0 &&
                !selTypes.includes(i.investment_type_code)
            )
                return false;
            return true;
        });
    }, [data, selUsers, selInstruments, selTypes]);

    const total = useMemo(
        () => filtered.reduce((s, i) => s + (i.amount || 0), 0),
        [filtered]
    );

    return (
        <div className={rStyles.reportBlock}>
            <MultiSelect
                label="User"
                options={userOptions}
                selected={selUsers}
                onChange={setSelUsers}
            />
            <MultiSelect
                label="Instrument Type"
                options={instrumentOptions}
                selected={selInstruments}
                onChange={setSelInstruments}
            />
            <MultiSelect
                label="Investment Type"
                options={typeOptions}
                selected={selTypes}
                onChange={setSelTypes}
            />

            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <p>No investments match the filters.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Ref ID</th>
                                <th>Name</th>
                                <th>Bank</th>
                                <th>Instrument</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Invested On</th>
                                <th>Maturity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((inv) => (
                                <tr key={inv.id}>
                                    <td>
                                        {inv.first_name} {inv.last_name}{" "}
                                        <span className={styles.cardBadge}>
                                            @{inv.username}
                                        </span>
                                    </td>
                                    <td>
                                        <code>{inv.investment_ref_id}</code>
                                    </td>
                                    <td>{inv.investment_name}</td>
                                    <td>
                                        <div>{inv.bank_name}</div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "#9ca3af",
                                            }}
                                        >
                                            {inv.branch_name}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {inv.instrument_code}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {inv.investment_type_code}
                                        </span>
                                    </td>
                                    <td>{fmt(inv.amount)}</td>
                                    <td>{inv.investment_date}</td>
                                    <td>{inv.maturity_date || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={6}
                                    style={{
                                        textAlign: "right",
                                        fontWeight: 600,
                                        color: "#94a3b8",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    Total Invested
                                </td>
                                <td
                                    style={{
                                        fontWeight: 700,
                                        color: "#e2e8f0",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    {fmt(total)}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

function MonthlyDebitTable({ data }) {
    const [selUsers, setSelUsers] = useState([]);
    const [selInstruments, setSelInstruments] = useState([]);
    const [selTypes, setSelTypes] = useState([]);

    const userOptions = [...new Set(data.map((i) => i.username))];
    const instrumentOptions = [...new Set(data.map((i) => i.instrument_code))];
    const typeOptions = [...new Set(data.map((i) => i.investment_type_code))];

    const filtered = useMemo(() => {
        return data.filter((i) => {
            if (selUsers.length > 0 && !selUsers.includes(i.username))
                return false;
            if (
                selInstruments.length > 0 &&
                !selInstruments.includes(i.instrument_code)
            )
                return false;
            if (
                selTypes.length > 0 &&
                !selTypes.includes(i.investment_type_code)
            )
                return false;
            return true;
        });
    }, [data, selUsers, selInstruments, selTypes]);

    const total = useMemo(
        () => filtered.reduce((s, i) => s + (i.amount || 0), 0),
        [filtered]
    );

    return (
        <div className={rStyles.reportBlock}>
            <MultiSelect
                label="User"
                options={userOptions}
                selected={selUsers}
                onChange={setSelUsers}
            />
            <MultiSelect
                label="Instrument Type"
                options={instrumentOptions}
                selected={selInstruments}
                onChange={setSelInstruments}
            />
            <MultiSelect
                label="Investment Type"
                options={typeOptions}
                selected={selTypes}
                onChange={setSelTypes}
            />

            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <p>No SIP investments found.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Ref ID</th>
                                <th>Name</th>
                                <th>Bank</th>
                                <th>Instrument</th>
                                <th>Type</th>
                                <th>Monthly Amount</th>
                                <th>Invested On</th>
                                <th>Maturity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((inv) => (
                                <tr key={inv.id}>
                                    <td>
                                        {inv.first_name} {inv.last_name}{" "}
                                        <span className={styles.cardBadge}>
                                            @{inv.username}
                                        </span>
                                    </td>
                                    <td>
                                        <code>{inv.investment_ref_id}</code>
                                    </td>
                                    <td>{inv.investment_name}</td>
                                    <td>
                                        <div>{inv.bank_name}</div>
                                        <div
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "#9ca3af",
                                            }}
                                        >
                                            {inv.branch_name}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {inv.instrument_code}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {inv.investment_type_code}
                                        </span>
                                    </td>
                                    <td>{fmt(inv.amount)}</td>
                                    <td>{inv.investment_date}</td>
                                    <td>{inv.maturity_date || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={6}
                                    style={{
                                        textAlign: "right",
                                        fontWeight: 600,
                                        color: "#94a3b8",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    Total Monthly Debit
                                </td>
                                <td
                                    style={{
                                        fontWeight: 700,
                                        color: "#e2e8f0",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    {fmt(total)}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function FinancePage() {
    const [allInvestments, setAllInvestments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.electronAPI.investments
            .getAllUsers()
            .then((data) => setAllInvestments(data ?? []))
            .finally(() => setLoading(false));
    }, []);

    // Active investments only
    const activeInvestments = useMemo(
        () => allInvestments.filter((i) => !i.is_closed),
        [allInvestments]
    );

    // SIP + active only
    const sipInvestments = useMemo(
        () => activeInvestments.filter((i) => i.investment_type_code === "SIP"),
        [activeInvestments]
    );

    if (loading) return <p className={styles.empty}>Loading...</p>;

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Investment Reports</h2>
                    <p className={styles.subtitle}>
                        Admin view — all users, active investments only
                    </p>
                </div>
            </div>

            {/* ── Report 1: All Active Investments ── */}
            <div className={rStyles.reportSection}>
                <h3 className={rStyles.reportTitle}>
                    📊 All Active Investments
                </h3>
                <InvestmentReportTable data={activeInvestments} />
            </div>

            {/* ── Report 2: Monthly Debit Summary (SIP) ── */}
            <div className={rStyles.reportSection}>
                <h3 className={rStyles.reportTitle}>
                    📅 Monthly Debit Summary{" "}
                    <span className={rStyles.reportBadge}>SIP Only</span>
                </h3>
                <MonthlyDebitTable data={sipInvestments} />
            </div>
        </section>
    );
}
