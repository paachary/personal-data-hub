"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./finance.module.css";
import InvestmentModal from "./InvestmentModal";
import UserFilter from "./UserFilter";

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

export default function InvestmentsSection({
    userId,
    isAdmin,
    viewAll = false,
}) {
    const [investments, setInvestments] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [filter, setFilter] = useState("all");
    const [modal, setModal] = useState(null);
    const [loading, setLoading] = useState(true);

    const [selectedUsers, setSelectedUsers] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (viewAll) {
                // Admin: fetch all users' investments
                const data = await window.electronAPI.investments.getAllUsers();
                setInvestments(data ?? []);
            } else {
                const [inv, acc] = await Promise.all([
                    window.electronAPI.investments.getByUser(userId),
                    window.electronAPI.accounts.getByUser(userId),
                ]);
                setInvestments(inv ?? []);
                setAccounts(acc ?? []);
            }
        } finally {
            setLoading(false);
        }
    }, [userId, viewAll]);

    useEffect(() => {
        load();
    }, [load]);

    const deleteInvestment = async (id) => {
        if (!confirm("Delete this investment?")) return;
        await window.electronAPI.investments.delete(id);
        load();
    };

    const filtered = useMemo(() => {
        let data = investments;
        if (selectedUsers.length > 0)
            data = data.filter((i) => selectedUsers.includes(i.username));
        if (filter === "active") data = data.filter((i) => !i.is_closed);
        if (filter === "closed") data = data.filter((i) => i.is_closed);
        return data;
    }, [investments, selectedUsers, filter]);

    const totalAmount = useMemo(
        () => filtered.reduce((sum, inv) => sum + (inv.amount || 0), 0),
        [filtered]
    );

    // ── Admin "view all" mode ─────────────────────────────────────
    if (viewAll) {
        return (
            <section className={styles.section}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>
                            All Users — Investments
                        </h2>
                        <p className={styles.subtitle}>
                            Read-only view of all users&apos; investments
                        </p>
                    </div>
                </div>

                <UserFilter // ← add
                    data={investments}
                    selectedUsers={selectedUsers}
                    onChange={setSelectedUsers}
                />

                <div className={styles.tabs}>
                    {[
                        { key: "all", label: `All (${investments.length})` },
                        {
                            key: "active",
                            label: `Active (${
                                investments.filter((i) => !i.is_closed).length
                            })`,
                        },
                        {
                            key: "closed",
                            label: `Closed (${
                                investments.filter((i) => i.is_closed).length
                            })`,
                        },
                    ].map((t) => (
                        <button
                            key={t.key}
                            className={`${styles.tab} ${
                                filter === t.key ? styles.tabActive : ""
                            }`}
                            onClick={() => setFilter(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p className={styles.empty}>Loading...</p>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>📈</div>
                        <p>No investments found.</p>
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
                                    <th>Status</th>
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
                                        <td>
                                            {inv.is_closed ? (
                                                <span
                                                    className={
                                                        styles.closedBadge
                                                    }
                                                >
                                                    Closed
                                                </span>
                                            ) : (
                                                <span
                                                    className={
                                                        styles.activeBadge
                                                    }
                                                >
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td
                                        colSpan={6} // viewAll: 6 cols before Amount; regular: 5
                                        style={{
                                            textAlign: "right",
                                            fontWeight: 800,
                                            color: "#dfe6ee",
                                            padding: "0.75rem 1rem",
                                        }}
                                    >
                                        Total Invested
                                    </td>
                                    <td
                                        style={{
                                            fontWeight: 900,
                                            color: "#e2e8f0",
                                            padding: "0.75rem 1rem",
                                        }}
                                    >
                                        {fmt(totalAmount)}
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    // ── Regular user mode ─────────────────────────────────────────
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Investments</h2>
                    <p className={styles.subtitle}>
                        Track all your investments across instruments
                    </p>
                </div>
                {!isAdmin && (
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => setModal("add")}
                    >
                        + Add Investment
                    </button>
                )}
            </div>

            <div className={styles.tabs}>
                {[
                    { key: "all", label: `All (${investments.length})` },
                    {
                        key: "active",
                        label: `Active (${
                            investments.filter((i) => !i.is_closed).length
                        })`,
                    },
                    {
                        key: "closed",
                        label: `Closed (${
                            investments.filter((i) => i.is_closed).length
                        })`,
                    },
                ].map((t) => (
                    <button
                        key={t.key}
                        className={`${styles.tab} ${
                            filter === t.key ? styles.tabActive : ""
                        }`}
                        onClick={() => setFilter(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📈</div>
                    <p>No investments found.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Ref ID</th>
                                <th>Name</th>
                                <th>Bank</th>
                                <th>Instrument</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Invested On</th>
                                <th>Maturity</th>
                                <th>Status</th>
                                {!isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((inv) => (
                                <tr key={inv.id}>
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
                                    <td>
                                        {inv.is_closed ? (
                                            <span
                                                className={styles.closedBadge}
                                            >
                                                Closed
                                            </span>
                                        ) : (
                                            <span
                                                className={styles.activeBadge}
                                            >
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    {!isAdmin && (
                                        <td>
                                            <div className={styles.cardActions}>
                                                <button
                                                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                    onClick={() =>
                                                        setModal(inv)
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                    onClick={() =>
                                                        deleteInvestment(inv.id)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={5}
                                    style={{
                                        textAlign: "right",
                                        fontWeight: 800,
                                        color: "#dfe6ee",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    Total Invested
                                </td>
                                <td
                                    style={{
                                        fontWeight: 900,
                                        color: "#e2e8f0",
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    {fmt(totalAmount)}
                                </td>
                                <td colSpan={!isAdmin ? 4 : 3} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {modal && (
                <InvestmentModal
                    existing={modal === "add" ? null : modal}
                    accounts={accounts}
                    userId={userId}
                    onSave={() => {
                        setModal(null);
                        load();
                    }}
                    onClose={() => setModal(null)}
                />
            )}
        </section>
    );
}
