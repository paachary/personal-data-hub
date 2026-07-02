"use client";

import { useState, useEffect } from "react";
import styles from "./finance.module.css";

const ROWS_PER_PAGE = 20;

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n || 0);

const fmtDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

export default function TransactionsList({ statementId, accountId, onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadTransactions = async () => {
            setLoading(true);
            setError("");
            try {
                const data =
                    await window.electronAPI.finance.getStatementTransactions({
                        statementId,
                        accountId,
                    });
                setTransactions(data || []);
            } catch (err) {
                setError(err.message);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };

        if (statementId && accountId) {
            loadTransactions();
        }
    }, [statementId, accountId]);

    // Filter transactions by search term
    const filtered = transactions.filter(
        (t) =>
            !searchTerm ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            fmtDate(t.date).includes(searchTerm),
    );

    // Pagination
    const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const paginatedData = filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);

    const handlePreviousPage = () => {
        setCurrentPage((p) => Math.max(1, p - 1));
    };

    const handleNextPage = () => {
        setCurrentPage((p) => Math.min(totalPages, p + 1));
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "900px" }}
            >
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        📊 Imported Transactions ({filtered.length})
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.fields}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            🔍 Search by Description or Date
                        </label>
                        <input
                            className={styles.input}
                            type="text"
                            placeholder="Filter transactions..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    {loading ? (
                        <p style={{ textAlign: "center", color: "#64748b" }}>
                            Loading transactions...
                        </p>
                    ) : filtered.length === 0 ? (
                        <div className={styles.empty}>
                            <p>No transactions found</p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Description</th>
                                            <th style={{ textAlign: "right" }}>
                                                Debit
                                            </th>
                                            <th style={{ textAlign: "right" }}>
                                                Credit
                                            </th>
                                            <th style={{ textAlign: "right" }}>
                                                Balance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedData.map((t, idx) => (
                                            <tr key={`${t.id}-${idx}`}>
                                                <td>{fmtDate(t.date)}</td>
                                                <td
                                                    style={{
                                                        maxWidth: "250px",
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={t.description}
                                                >
                                                    {t.description}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "right",
                                                        color: t.debit
                                                            ? "#fca5a5"
                                                            : "#64748b",
                                                    }}
                                                >
                                                    {t.debit > 0
                                                        ? fmt(t.debit)
                                                        : "—"}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "right",
                                                        color: t.credit
                                                            ? "#86efac"
                                                            : "#64748b",
                                                    }}
                                                >
                                                    {t.credit > 0
                                                        ? fmt(t.credit)
                                                        : "—"}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: "right",
                                                        color: "#cbd5e1",
                                                    }}
                                                >
                                                    {t.balance !== null
                                                        ? fmt(t.balance)
                                                        : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: "1rem",
                                    paddingTop: "1rem",
                                    borderTop: "1px solid #2a3352",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.82rem",
                                        color: "#64748b",
                                    }}
                                >
                                    Showing {startIdx + 1}-
                                    {Math.min(
                                        startIdx + ROWS_PER_PAGE,
                                        filtered.length,
                                    )}{" "}
                                    of {filtered.length}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "0.5rem",
                                        alignItems: "center",
                                    }}
                                >
                                    <button
                                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                        onClick={handlePreviousPage}
                                        disabled={currentPage === 1}
                                    >
                                        ← Previous
                                    </button>
                                    <div
                                        style={{
                                            fontSize: "0.82rem",
                                            color: "#cbd5e1",
                                            minWidth: "60px",
                                            textAlign: "center",
                                        }}
                                    >
                                        {currentPage} of {totalPages}
                                    </div>
                                    <button
                                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next →
                                    </button>
                                </div>
                                <div></div>
                            </div>
                        </>
                    )}

                    <div className={styles.actions}>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
