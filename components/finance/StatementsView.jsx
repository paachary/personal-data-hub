"use client";

import { useState, useEffect } from "react";
import styles from "./finance.module.css";

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

const BANK_NAMES = {
    HDFC: "HDFC Bank",
    ICICI: "ICICI Bank",
    SBI: "State Bank of India",
    UNION: "Union Bank",
    STANCHART: "Standard Chartered",
};

export default function StatementsView({ accountId, onClose }) {
    const [statements, setStatements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const loadStatements = async () => {
            setLoading(true);
            setError("");
            try {
                const data = await window.electronAPI.finance.getStatements({
                    accountId,
                });
                setStatements(data || []);
            } catch (err) {
                setError(err.message);
                setStatements([]);
            } finally {
                setLoading(false);
            }
        };

        if (accountId) {
            loadStatements();
        }
    }, [accountId]);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "1000px" }}
            >
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        📋 Imported Statements ({statements.length})
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.fields}>
                    {error && <p className={styles.error}>{error}</p>}

                    {loading ? (
                        <p style={{ textAlign: "center", color: "#64748b" }}>
                            Loading statements...
                        </p>
                    ) : statements.length === 0 ? (
                        <div className={styles.empty}>
                            <p>No statements imported yet</p>
                        </div>
                    ) : (
                        <div>
                            {statements.map((stmt) => (
                                <div
                                    key={stmt.id}
                                    style={{
                                        marginBottom: "1rem",
                                        borderRadius: "8px",
                                        border: "1px solid #2a3352",
                                        backgroundColor: "#0f172a",
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* Statement Header */}
                                    <button
                                        onClick={() => toggleExpand(stmt.id)}
                                        style={{
                                            width: "100%",
                                            padding: "1rem",
                                            backgroundColor:
                                                expandedId === stmt.id
                                                    ? "#1e293b"
                                                    : "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            color: "#e2e8f0",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "1rem",
                                                alignItems: "center",
                                                flex: 1,
                                            }}
                                        >
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: "#cbd5e1",
                                                    }}
                                                >
                                                    {BANK_NAMES[stmt.bank_code]}{" "}
                                                    <span
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "#94a3b8",
                                                            fontWeight: 400,
                                                        }}
                                                    >
                                                        ({stmt.bank_code})
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "0.85rem",
                                                        color: "#64748b",
                                                        marginTop: "0.25rem",
                                                    }}
                                                >
                                                    {fmtDate(stmt.start_date)}{" "}
                                                    to {fmtDate(stmt.end_date)}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "0.8rem",
                                                        color: "#475569",
                                                        marginTop: "0.25rem",
                                                    }}
                                                >
                                                    {stmt.file_name}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "2rem",
                                                alignItems: "center",
                                                paddingLeft: "1rem",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    textAlign: "right",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "#64748b",
                                                        marginBottom: "0.25rem",
                                                    }}
                                                >
                                                    Transactions
                                                </div>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        color: "#cbd5e1",
                                                    }}
                                                >
                                                    {stmt.row_count}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "1.2rem",
                                                    color: "#64748b",
                                                    transform:
                                                        expandedId === stmt.id
                                                            ? "rotate(180deg)"
                                                            : "rotate(0deg)",
                                                    transition:
                                                        "transform 0.3s",
                                                }}
                                            >
                                                ▼
                                            </div>
                                        </div>
                                    </button>

                                    {/* Statement Details (Expanded) */}
                                    {expandedId === stmt.id && (
                                        <div
                                            style={{
                                                padding: "1.5rem",
                                                borderTop: "1px solid #2a3352",
                                                backgroundColor: "#0f172a",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(2, 1fr)",
                                                    gap: "1.5rem",
                                                    marginBottom: "1.5rem",
                                                }}
                                            >
                                                {/* Opening Balance */}
                                                <div
                                                    style={{
                                                        padding: "1rem",
                                                        backgroundColor:
                                                            "#1e293b",
                                                        borderRadius: "8px",
                                                        borderLeft:
                                                            "4px solid #3b82f6",
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.5rem",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Opening Balance
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "1.25rem",
                                                            fontWeight: 700,
                                                            color: "#3b82f6",
                                                        }}
                                                    >
                                                        {fmt(
                                                            stmt.opening_balance,
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Closing Balance */}
                                                <div
                                                    style={{
                                                        padding: "1rem",
                                                        backgroundColor:
                                                            "#1e293b",
                                                        borderRadius: "8px",
                                                        borderLeft:
                                                            "4px solid #10b981",
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.5rem",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Closing Balance
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "1.25rem",
                                                            fontWeight: 700,
                                                            color: "#10b981",
                                                        }}
                                                    >
                                                        {fmt(
                                                            stmt.closing_balance,
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Total Debits */}
                                                <div
                                                    style={{
                                                        padding: "1rem",
                                                        backgroundColor:
                                                            "#1e293b",
                                                        borderRadius: "8px",
                                                        borderLeft:
                                                            "4px solid #f87171",
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.5rem",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Total Debits
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "1.25rem",
                                                            fontWeight: 700,
                                                            color: "#f87171",
                                                        }}
                                                    >
                                                        {fmt(stmt.total_debits)}
                                                    </p>
                                                </div>

                                                {/* Total Credits */}
                                                <div
                                                    style={{
                                                        padding: "1rem",
                                                        backgroundColor:
                                                            "#1e293b",
                                                        borderRadius: "8px",
                                                        borderLeft:
                                                            "4px solid #86efac",
                                                    }}
                                                >
                                                    <p
                                                        style={{
                                                            fontSize: "0.85rem",
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.5rem",
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Total Credits
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontSize: "1.25rem",
                                                            fontWeight: 700,
                                                            color: "#86efac",
                                                        }}
                                                    >
                                                        {fmt(
                                                            stmt.total_credits,
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Meta Info */}
                                            <div
                                                style={{
                                                    paddingTop: "1rem",
                                                    borderTop:
                                                        "1px solid #2a3352",
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(3, 1fr)",
                                                    gap: "1rem",
                                                    fontSize: "0.85rem",
                                                }}
                                            >
                                                <div>
                                                    <p
                                                        style={{
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.25rem",
                                                        }}
                                                    >
                                                        Status
                                                    </p>
                                                    <p
                                                        style={{
                                                            fontWeight: 600,
                                                            color:
                                                                stmt.import_status ===
                                                                "success"
                                                                    ? "#86efac"
                                                                    : "#f87171",
                                                        }}
                                                    >
                                                        {stmt.import_status}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p
                                                        style={{
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.25rem",
                                                        }}
                                                    >
                                                        Imported
                                                    </p>
                                                    <p
                                                        style={{
                                                            color: "#cbd5e1",
                                                        }}
                                                    >
                                                        {fmtDate(
                                                            stmt.import_date,
                                                        )}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p
                                                        style={{
                                                            color: "#94a3b8",
                                                            marginBottom:
                                                                "0.25rem",
                                                        }}
                                                    >
                                                        File
                                                    </p>
                                                    <p
                                                        style={{
                                                            color: "#cbd5e1",
                                                            wordBreak:
                                                                "break-word",
                                                        }}
                                                    >
                                                        {stmt.file_name}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
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
