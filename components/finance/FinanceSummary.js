"use client";

import styles from "./finance.module.css";

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

export default function FinanceSummary({ investments = [], accounts = [] }) {
    const active = investments.filter((i) => !i.is_closed);
    const closed = investments.filter((i) => i.is_closed);
    const total = investments.reduce((s, i) => s + (i.amount || 0), 0);
    const activeAmt = active.reduce((s, i) => s + (i.amount || 0), 0);

    const cards = [
        { label: "Total Invested", value: fmt(total), icon: "💰" },
        { label: "Active Investments", value: fmt(activeAmt), icon: "📈" },
        { label: "Active Count", value: active.length, icon: "✅" },
        { label: "Closed Count", value: closed.length, icon: "🔒" },
        { label: "Bank Accounts", value: accounts.length, icon: "🏦" },
    ];

    return (
        <div className={styles.summaryGrid}>
            {cards.map((c) => (
                <div key={c.label} className={styles.summaryCard}>
                    <p className={styles.summaryLabel}>
                        {c.icon} {c.label}
                    </p>
                    <p className={styles.summaryValue}>{c.value}</p>
                </div>
            ))}
        </div>
    );
}
