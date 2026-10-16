"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./finance.module.css";
import StatementsView from "./StatementsView";
import TransactionsList from "./TransactionsList";
import TransactionTrendChart from "./TransactionTrendChart";
import StatementImportModal from "./StatementImportModal";

export default function StatementsAnalyticsSection({ userId, isAdmin }) {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [importModal, setImportModal] = useState(false);
    const [showStatementsView, setShowStatementsView] = useState(false);
    const [showTransactionsList, setShowTransactionsList] = useState(null);
    const [showTrendChart, setShowTrendChart] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const accountData =
                await window.electronAPI.accounts.getByUser(userId);
            setAccounts(accountData ?? []);
            if (accountData && accountData.length > 0) {
                setSelectedAccountId(accountData[0].id);
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleViewTransactions = (statementId, accountId) => {
        setShowTransactionsList({ statementId, accountId });
        setImportModal(false);
    };

    const handleCloseTransactionsList = () => {
        setShowTransactionsList(null);
    };

    // Show Statements View
    if (showStatementsView && selectedAccountId) {
        return (
            <>
                <section className={styles.section}>
                    <div className={styles.header}>
                        <div>
                            <h2 className={styles.title}>📊 Statements</h2>
                            <p className={styles.subtitle}>
                                Manage and analyze imported bank statements
                            </p>
                        </div>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => setShowStatementsView(false)}
                        >
                            ← Back
                        </button>
                    </div>
                </section>
                <StatementsView
                    accountId={selectedAccountId}
                    onClose={() => setShowStatementsView(false)}
                />
            </>
        );
    }

    // Show Transactions List
    if (showTransactionsList) {
        return (
            <>
                <section className={styles.section}>
                    <div className={styles.header}>
                        <div>
                            <h2 className={styles.title}>📊 Statements</h2>
                            <p className={styles.subtitle}>
                                Manage and analyze imported bank statements
                            </p>
                        </div>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={handleCloseTransactionsList}
                        >
                            ← Back
                        </button>
                    </div>
                </section>
                <TransactionsList
                    statementId={showTransactionsList.statementId}
                    accountId={showTransactionsList.accountId}
                    onClose={handleCloseTransactionsList}
                />
            </>
        );
    }

    // Show Trend Chart
    if (showTrendChart && selectedAccountId) {
        return (
            <>
                <section className={styles.section}>
                    <div className={styles.header}>
                        <div>
                            <h2 className={styles.title}>📊 Statements</h2>
                            <p className={styles.subtitle}>
                                Manage and analyze imported bank statements
                            </p>
                        </div>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => setShowTrendChart(false)}
                        >
                            ← Back
                        </button>
                    </div>
                </section>
                <TransactionTrendChart
                    accountId={selectedAccountId}
                    onClose={() => setShowTrendChart(false)}
                />
            </>
        );
    }

    // Main Dashboard View
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>📊 Statements & Analytics</h2>
                    <p className={styles.subtitle}>
                        Import, view, and analyze your bank statements
                    </p>
                </div>
                <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setImportModal(true)}
                >
                    📥 Import Statement
                </button>
                <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    style={{ marginLeft: "0.5rem" }}
                    onClick={async () => {
                        const target = selectedAccountId
                            ? accounts.find((a) => a.id === selectedAccountId)
                            : null;
                        const label = target
                            ? `${target.bank_name} — ${target.account_number}`
                            : "ALL accounts";
                        if (
                            !confirm(
                                `Delete all imported statement data for ${label}? This cannot be undone.`,
                            )
                        )
                            return;
                        const result =
                            await window.electronAPI.finance.clearStatementData(
                                selectedAccountId
                                    ? { accountId: selectedAccountId }
                                    : {},
                            );
                        if (result.success) {
                            alert("Statement data cleared successfully.");
                        } else {
                            alert("Error: " + result.message);
                        }
                    }}
                >
                    🗑️ Clear Data
                </button>
            </div>

            {/* Account Selector */}
            {!loading && accounts.length > 0 && (
                <div
                    style={{
                        marginBottom: "2rem",
                        padding: "1rem",
                        backgroundColor: "#1e293b",
                        borderRadius: "8px",
                        border: "1px solid #2a3352",
                    }}
                >
                    <label
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            color: "#cbd5e1",
                        }}
                    >
                        🏦 Select Account
                    </label>
                    <select
                        value={selectedAccountId || ""}
                        onChange={(e) =>
                            setSelectedAccountId(parseInt(e.target.value, 10))
                        }
                        style={{
                            width: "100%",
                            padding: "0.75rem",
                            backgroundColor: "#0f172a",
                            color: "#e2e8f0",
                            border: "1px solid #2a3352",
                            borderRadius: "6px",
                            fontSize: "0.95rem",
                        }}
                    >
                        <option value="">— Select Account —</option>
                        {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.bank_name} — {acc.account_number} (
                                {acc.account_type})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Action Cards */}
            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : accounts.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🏦</div>
                    <p>No accounts found. Add an account to get started.</p>
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1.5rem",
                    }}
                >
                    {/* Statements Card */}
                    <div
                        style={{
                            padding: "2rem",
                            backgroundColor: "#1e293b",
                            borderRadius: "12px",
                            border: "1px solid #2a3352",
                            cursor: "pointer",
                            transition: "all 0.3s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#334155";
                            e.currentTarget.style.borderColor = "#475569";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#1e293b";
                            e.currentTarget.style.borderColor = "#2a3352";
                        }}
                        onClick={() => setShowStatementsView(true)}
                    >
                        <div
                            style={{
                                fontSize: "2.5rem",
                                marginBottom: "1rem",
                            }}
                        >
                            📋
                        </div>
                        <h3
                            style={{
                                fontSize: "1.25rem",
                                fontWeight: 600,
                                color: "#e2e8f0",
                                marginBottom: "0.5rem",
                            }}
                        >
                            View Statements
                        </h3>
                        <p
                            style={{
                                color: "#94a3b8",
                                fontSize: "0.9rem",
                                marginBottom: "1rem",
                            }}
                        >
                            Browse all imported statements with opening/closing
                            balances and transaction summaries
                        </p>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            style={{ width: "100%" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowStatementsView(true);
                            }}
                        >
                            View →
                        </button>
                    </div>

                    {/* Trends Card */}
                    <div
                        style={{
                            padding: "2rem",
                            backgroundColor: "#1e293b",
                            borderRadius: "12px",
                            border: "1px solid #2a3352",
                            cursor: "pointer",
                            transition: "all 0.3s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#334155";
                            e.currentTarget.style.borderColor = "#475569";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#1e293b";
                            e.currentTarget.style.borderColor = "#2a3352";
                        }}
                        onClick={() => setShowTrendChart(true)}
                    >
                        <div
                            style={{
                                fontSize: "2.5rem",
                                marginBottom: "1rem",
                            }}
                        >
                            📈
                        </div>
                        <h3
                            style={{
                                fontSize: "1.25rem",
                                fontWeight: 600,
                                color: "#e2e8f0",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Analyze Trends
                        </h3>
                        <p
                            style={{
                                color: "#94a3b8",
                                fontSize: "0.9rem",
                                marginBottom: "1rem",
                            }}
                        >
                            View debit/credit trends over time with flexible
                            date ranges and aggregation periods
                        </p>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            style={{ width: "100%" }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTrendChart(true);
                            }}
                        >
                            Analyze →
                        </button>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModal && (
                <StatementImportModal
                    accounts={accounts}
                    userId={userId}
                    onClose={() => setImportModal(false)}
                    onSuccess={() => {
                        setImportModal(false);
                        load();
                    }}
                    onViewTransactions={handleViewTransactions}
                />
            )}
        </section>
    );
}
