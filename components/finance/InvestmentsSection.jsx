"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./finance.module.css";
import InvestmentModal from "./InvestmentModal";
import UserFilter from "./UserFilter";
import InvestmentDistributionChart from "./InvestmentDistributionChart";

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
    const [chartUser, setChartUser] = useState("");

    const [selectedBank, setSelectedBank] = useState("");
    const [selectedInstrument, setSelectedInstrument] = useState("");
    const [selectedType, setSelectedType] = useState("");

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

    // Set default chart user to first user in the list when data loads (admin only)
    useEffect(() => {
        if (viewAll && investments.length > 0 && !chartUser) {
            setChartUser(investments[0].username);
        }
    }, [viewAll, investments, chartUser]);

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
        if (selectedBank)
            data = data.filter((i) => i.bank_name === selectedBank);
        if (selectedInstrument)
            data = data.filter((i) => i.instrument_code === selectedInstrument);
        if (selectedType)
            data = data.filter((i) => i.investment_type_code === selectedType);
        // Sort by bank name, then by user
        return data.sort((a, b) => {
            if (a.bank_name !== b.bank_name) {
                return a.bank_name.localeCompare(b.bank_name);
            }
            return a.user_id - b.user_id;
        });
    }, [
        investments,
        selectedUsers,
        filter,
        selectedBank,
        selectedInstrument,
        selectedType,
    ]);

    const totalAmount = useMemo(
        () => filtered.reduce((sum, inv) => sum + (inv.amount || 0), 0),
        [filtered],
    );

    // Derive sorted unique users for the admin chart dropdown
    const adminUserOptions = useMemo(() => {
        const seen = new Set();
        return investments
            .filter((i) => {
                if (seen.has(i.username)) return false;
                seen.add(i.username);
                return true;
            })
            .map((i) => ({
                username: i.username,
                name: `${i.first_name} ${i.last_name}`,
            }));
    }, [investments]);

    // Investments for the selected chart user, respecting the active filter
    const chartUserInvestments = useMemo(() => {
        let data = investments.filter((i) => i.username === chartUser);
        if (filter === "active") data = data.filter((i) => !i.is_closed);
        if (filter === "closed") data = data.filter((i) => i.is_closed);
        // Sort by bank name
        return data.sort((a, b) => a.bank_name.localeCompare(b.bank_name));
    }, [investments, chartUser, filter]);

    // Derive sorted unique banks, instruments, and types
    const bankOptions = useMemo(() => {
        const seen = new Set();
        return investments
            .filter((i) => {
                if (seen.has(i.bank_name)) return false;
                seen.add(i.bank_name);
                return true;
            })
            .map((i) => i.bank_name)
            .sort();
    }, [investments]);

    const instrumentOptions = useMemo(() => {
        const seen = new Set();
        return investments
            .filter((i) => {
                if (seen.has(i.instrument_code)) return false;
                seen.add(i.instrument_code);
                return true;
            })
            .map((i) => i.instrument_code)
            .sort();
    }, [investments]);

    const typeOptions = useMemo(() => {
        const seen = new Set();
        return investments
            .filter((i) => {
                if (seen.has(i.investment_type_code)) return false;
                seen.add(i.investment_type_code);
                return true;
            })
            .map((i) => i.investment_type_code)
            .sort();
    }, [investments]);

    // ── Helper functions for DRY principle ──────────────────────────
    const renderFilterDropdown = (label, options, value, onChange) => (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
            }}
        >
            <label
                style={{
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    color: "#1a1a1a",
                }}
            >
                {label}
            </label>
            <select className={styles.select} value={value} onChange={onChange}>
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderFilterDropdowns = () => (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {renderFilterDropdown("Bank", bankOptions, selectedBank, (e) =>
                setSelectedBank(e.target.value),
            )}
            {renderFilterDropdown(
                "Instrument",
                instrumentOptions,
                selectedInstrument,
                (e) => setSelectedInstrument(e.target.value),
            )}
            {renderFilterDropdown("Type", typeOptions, selectedType, (e) =>
                setSelectedType(e.target.value),
            )}
        </div>
    );

    const renderTabs = () => (
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
    );

    const renderStatusBadge = (isClosed) =>
        isClosed ? (
            <span className={styles.closedBadge}>Closed</span>
        ) : (
            <span className={styles.activeBadge}>Active</span>
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

                {/* ── Per-user chart ───────────────────────────── */}
                {!loading && adminUserOptions.length > 0 && (
                    <div className={styles.chartSection}>
                        <div className={styles.chartUserPickerRow}>
                            <label className={styles.chartUserPickerLabel}>
                                Chart for user:
                            </label>
                            <select
                                className={styles.chartUserSelect}
                                value={chartUser}
                                onChange={(e) => setChartUser(e.target.value)}
                            >
                                {adminUserOptions.map((u) => (
                                    <option key={u.username} value={u.username}>
                                        {u.name} (@{u.username})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <InvestmentDistributionChart
                            investments={chartUserInvestments}
                        />
                    </div>
                )}

                <UserFilter // ← add
                    data={investments}
                    selectedUsers={selectedUsers}
                    onChange={setSelectedUsers}
                />

                {/* ── Filter dropdowns ─────────────────────────── */}
                {renderFilterDropdowns()}

                {renderTabs()}

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
                                            {renderStatusBadge(inv.is_closed)}
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

                                            padding: "0.75rem 1rem",
                                        }}
                                    >
                                        Total Invested
                                    </td>
                                    <td
                                        style={{
                                            fontWeight: 900,

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

            {!loading && investments.length > 0 && (
                <InvestmentDistributionChart investments={filtered} />
            )}

            {/* ── Filter dropdowns ─────────────────────────── */}
            {renderFilterDropdowns()}

            {renderTabs()}

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
                                    <td>{renderStatusBadge(inv.is_closed)}</td>
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
                                        padding: "0.75rem 1rem",
                                    }}
                                >
                                    Total Invested
                                </td>
                                <td
                                    style={{
                                        fontWeight: 900,
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
