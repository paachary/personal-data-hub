"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "@/components/finance/finance.module.css";
import fStyles from "@/components/finance/filter.module.css";
import rStyles from "./report.module.css";
import UserMonthlyDebitSummary from "@/components/finance/UserMonthlyDebitSummary";

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
                : [...selected, val],
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

function ReportTable({ data, columns, footerLabel, emptyMessage }) {
    const [selUsers, setSelUsers] = useState([]);
    const [selBanks, setSelBanks] = useState([]);
    const [selInstruments, setSelInstruments] = useState([]);
    const [selTypes, setSelTypes] = useState([]);

    const userOptions = [...new Set(data.map((i) => i.username))];
    const bankOptions = [...new Set(data.map((i) => i.bank_name))];
    const instrumentOptions = [...new Set(data.map((i) => i.instrument_code))];
    const typeOptions = [...new Set(data.map((i) => i.investment_type_code))];

    const filtered = useMemo(() => {
        let result = data.filter((i) => {
            if (selUsers.length > 0 && !selUsers.includes(i.username))
                return false;
            if (selBanks.length > 0 && !selBanks.includes(i.bank_name))
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
        // Sort by username, then by bank_name
        return result.sort((a, b) => {
            if (a.username !== b.username) {
                return a.username.localeCompare(b.username);
            }
            return a.bank_name.localeCompare(b.bank_name);
        });
    }, [data, selUsers, selBanks, selInstruments, selTypes]);

    const total = useMemo(
        () => filtered.reduce((s, i) => s + (i.amount || 0), 0),
        [filtered],
    );

    const amountColIndex = columns.findIndex((col) => col.key === "amount");

    return (
        <div className={rStyles.reportBlock}>
            <MultiSelect
                label="User"
                options={userOptions}
                selected={selUsers}
                onChange={setSelUsers}
            />
            <MultiSelect
                label="Bank"
                options={bankOptions}
                selected={selBanks}
                onChange={setSelBanks}
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
                    <p>{emptyMessage}</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.key}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((inv) => (
                                <tr key={inv.id}>
                                    {columns.map((col) => (
                                        <td key={col.key}>
                                            {col.render
                                                ? col.render(inv[col.key], inv)
                                                : inv[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={amountColIndex}
                                    style={{
                                        textAlign: "right",
                                        fontWeight: 600,
                                        color: "#94a3b8",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    {footerLabel}
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
                                <td
                                    colSpan={
                                        columns.length - amountColIndex - 1
                                    }
                                />
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
    const [collapsed, setCollapsed] = useState({
        active: true,
        debitByUser: false,
        debitSip: true,
    });

    const toggleSection = (section) => {
        setCollapsed((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    useEffect(() => {
        window.electronAPI.investments
            .getAllUsers()
            .then((data) => setAllInvestments(data ?? []))
            .finally(() => setLoading(false));
    }, []);

    // Active investments only
    const activeInvestments = useMemo(
        () => allInvestments.filter((i) => !i.is_closed),
        [allInvestments],
    );

    // SIP + active only
    const sipInvestments = useMemo(
        () => activeInvestments.filter((i) => i.investment_type_code === "SIP"),
        [activeInvestments],
    );

    // Column definitions for all active investments
    const investmentColumns = [
        {
            key: "username",
            label: "User",
            render: (val, inv) => (
                <>
                    {inv.first_name} {inv.last_name}{" "}
                    <span className={styles.cardBadge}>@{val}</span>
                </>
            ),
        },
        {
            key: "investment_ref_id",
            label: "Ref ID",
            render: (val) => <code>{val}</code>,
        },
        {
            key: "investment_name",
            label: "Name",
        },
        {
            key: "bank_name",
            label: "Bank",
            render: (val, inv) => (
                <>
                    <div>{val}</div>
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        {inv.branch_name}
                    </div>
                </>
            ),
        },
        {
            key: "instrument_code",
            label: "Instrument",
            render: (val) => <span className={styles.cardBadge}>{val}</span>,
        },
        {
            key: "investment_type_code",
            label: "Type",
            render: (val) => <span className={styles.cardBadge}>{val}</span>,
        },
        {
            key: "amount",
            label: "Amount",
            render: (val) => fmt(val),
        },
        {
            key: "investment_date",
            label: "Invested On",
        },
        {
            key: "maturity_date",
            label: "Maturity",
            render: (val) => val || "—",
        },
    ];

    // Column definitions for SIP investments (same as above but with "Monthly Amount" label)
    const sipColumns = [
        {
            key: "username",
            label: "User",
            render: (val, inv) => (
                <>
                    {inv.first_name} {inv.last_name}{" "}
                    <span className={styles.cardBadge}>@{val}</span>
                </>
            ),
        },
        {
            key: "investment_ref_id",
            label: "Ref ID",
            render: (val) => <code>{val}</code>,
        },
        {
            key: "investment_name",
            label: "Name",
        },
        {
            key: "bank_name",
            label: "Bank",
            render: (val, inv) => (
                <>
                    <div>{val}</div>
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                        }}
                    >
                        {inv.branch_name}
                    </div>
                </>
            ),
        },
        {
            key: "instrument_code",
            label: "Instrument",
            render: (val) => <span className={styles.cardBadge}>{val}</span>,
        },
        {
            key: "investment_type_code",
            label: "Type",
            render: (val) => <span className={styles.cardBadge}>{val}</span>,
        },
        {
            key: "amount",
            label: "Monthly Amount",
            render: (val) => fmt(val),
        },
        {
            key: "investment_date",
            label: "Invested On",
        },
        {
            key: "maturity_date",
            label: "Maturity",
            render: (val) => val || "—",
        },
    ];

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
                <button
                    className={rStyles.reportHeader}
                    onClick={() => toggleSection("active")}
                >
                    <h3 className={rStyles.reportTitle}>
                        📊 All Active Investments
                    </h3>
                    <span className={rStyles.collapseIcon}>
                        {collapsed.active ? "▶" : "▼"}
                    </span>
                </button>
                {!collapsed.active && (
                    <ReportTable
                        data={activeInvestments}
                        columns={investmentColumns}
                        footerLabel="Total Invested"
                        emptyMessage="No investments match the filters."
                    />
                )}
            </div>

            {/* ── Report 2: Monthly Debit Summary by User ── */}
            <div className={rStyles.reportSection}>
                <button
                    className={rStyles.reportHeader}
                    onClick={() => toggleSection("debitByUser")}
                >
                    <h3 className={rStyles.reportTitle}>
                        👥 Monthly Debit Summary by User{" "}
                        <span className={rStyles.reportBadge}>SIP Only</span>
                    </h3>
                    <span className={rStyles.collapseIcon}>
                        {collapsed.debitByUser ? "▶" : "▼"}
                    </span>
                </button>
                {!collapsed.debitByUser && (
                    <UserMonthlyDebitSummary data={sipInvestments} />
                )}
            </div>

            {/* ── Report 3: Monthly Debit Summary (SIP) ── */}
            <div className={rStyles.reportSection}>
                <button
                    className={rStyles.reportHeader}
                    onClick={() => toggleSection("debitSip")}
                >
                    <h3 className={rStyles.reportTitle}>
                        📅 Monthly Debit Summary{" "}
                        <span className={rStyles.reportBadge}>SIP Only</span>
                    </h3>
                    <span className={rStyles.collapseIcon}>
                        {collapsed.debitSip ? "▶" : "▼"}
                    </span>
                </button>
                {!collapsed.debitSip && (
                    <ReportTable
                        data={sipInvestments}
                        columns={sipColumns}
                        footerLabel="Total Monthly Debit"
                        emptyMessage="No SIP investments found."
                    />
                )}
            </div>
        </section>
    );
}
