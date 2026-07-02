"use client";

import { useState, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import styles from "./finance.module.css";

const PERIODS = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
];

const getDateRange = (preset) => {
    const today = new Date();
    const from = new Date();

    switch (preset) {
        case "30days":
            from.setDate(today.getDate() - 30);
            break;
        case "3months":
            from.setMonth(today.getMonth() - 3);
            break;
        case "1year":
            from.setFullYear(today.getFullYear() - 1);
            break;
        default:
            from.setDate(today.getDate() - 30);
    }

    return {
        from: from.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
    };
};

const fmtAmount = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n || 0);

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className={styles.chartTooltip}>
            <p className={styles.chartTooltipName}>
                {payload[0].payload.period}
            </p>
            {payload.map((entry, idx) => (
                <p key={idx} className={styles.chartTooltipValue}>
                    <span style={{ color: entry.color }}>●</span> {entry.name}:{" "}
                    {fmtAmount(entry.value)}
                </p>
            ))}
        </div>
    );
};

export default function TransactionTrendChart({ accountId, onClose }) {
    const [period, setPeriod] = useState("monthly");
    const [datePreset, setDatePreset] = useState("30days");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [showCustom, setShowCustom] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError("");
            try {
                const dateRange = showCustom
                    ? {
                          from: customDateFrom,
                          to: customDateTo,
                      }
                    : getDateRange(datePreset);

                if (!dateRange.from || !dateRange.to) {
                    setError("Please select valid dates");
                    setData([]);
                    setLoading(false);
                    return;
                }

                const result = await window.electronAPI.finance.getTrendData({
                    accountId,
                    period,
                    fromDate: dateRange.from,
                    toDate: dateRange.to,
                });

                setData(result || []);
            } catch (err) {
                setError(err.message);
                setData([]);
            } finally {
                setLoading(false);
            }
        };

        if (accountId) {
            loadData();
        }
    }, [
        accountId,
        period,
        datePreset,
        showCustom,
        customDateFrom,
        customDateTo,
    ]);

    // Calculate summary stats
    const summary = data.reduce(
        (acc, d) => ({
            totalDebits: acc.totalDebits + (d.total_debits || 0),
            totalCredits: acc.totalCredits + (d.total_credits || 0),
        }),
        { totalDebits: 0, totalCredits: 0 },
    );

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.modal}
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "1000px", maxHeight: "85vh" }}
            >
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>📈 Transaction Trends</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className={styles.fields}>
                    {/* Period Selector */}
                    <div className={styles.field}>
                        <label className={styles.label}>
                            📅 Aggregation Period
                        </label>
                        <select
                            className={styles.select}
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                        >
                            {PERIODS.map((p) => (
                                <option key={p.value} value={p.value}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Selector */}
                    <div className={styles.field}>
                        <label className={styles.label}>🗓️ Date Range</label>
                        <div
                            style={{
                                display: "flex",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                type="button"
                                className={`${styles.btn} ${
                                    !showCustom && datePreset === "30days"
                                        ? styles.btnPrimary
                                        : styles.btnSecondary
                                } ${styles.btnSm}`}
                                onClick={() => {
                                    setShowCustom(false);
                                    setDatePreset("30days");
                                }}
                            >
                                Last 30 days
                            </button>
                            <button
                                type="button"
                                className={`${styles.btn} ${
                                    !showCustom && datePreset === "3months"
                                        ? styles.btnPrimary
                                        : styles.btnSecondary
                                } ${styles.btnSm}`}
                                onClick={() => {
                                    setShowCustom(false);
                                    setDatePreset("3months");
                                }}
                            >
                                Last 3 months
                            </button>
                            <button
                                type="button"
                                className={`${styles.btn} ${
                                    !showCustom && datePreset === "1year"
                                        ? styles.btnPrimary
                                        : styles.btnSecondary
                                } ${styles.btnSm}`}
                                onClick={() => {
                                    setShowCustom(false);
                                    setDatePreset("1year");
                                }}
                            >
                                Last year
                            </button>
                            <button
                                type="button"
                                className={`${styles.btn} ${
                                    showCustom
                                        ? styles.btnPrimary
                                        : styles.btnSecondary
                                } ${styles.btnSm}`}
                                onClick={() => setShowCustom(!showCustom)}
                            >
                                Custom
                            </button>
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    {showCustom && (
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    From Date
                                </label>
                                <input
                                    className={styles.input}
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(e) =>
                                        setCustomDateFrom(e.target.value)
                                    }
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>To Date</label>
                                <input
                                    className={styles.input}
                                    type="date"
                                    value={customDateTo}
                                    onChange={(e) =>
                                        setCustomDateTo(e.target.value)
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className={styles.error}>{error}</p>}

                    {/* Summary Stats */}
                    {data.length > 0 && !loading && (
                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryCard}>
                                <p className={styles.summaryLabel}>
                                    Total Debits
                                </p>
                                <p
                                    className={styles.summaryValue}
                                    style={{ color: "#fca5a5" }}
                                >
                                    {fmtAmount(summary.totalDebits)}
                                </p>
                            </div>
                            <div className={styles.summaryCard}>
                                <p className={styles.summaryLabel}>
                                    Total Credits
                                </p>
                                <p
                                    className={styles.summaryValue}
                                    style={{ color: "#86efac" }}
                                >
                                    {fmtAmount(summary.totalCredits)}
                                </p>
                            </div>
                            <div className={styles.summaryCard}>
                                <p className={styles.summaryLabel}>Net</p>
                                <p
                                    className={styles.summaryValue}
                                    style={{
                                        color:
                                            summary.totalCredits -
                                                summary.totalDebits >
                                            0
                                                ? "#86efac"
                                                : "#fca5a5",
                                    }}
                                >
                                    {fmtAmount(
                                        summary.totalCredits -
                                            summary.totalDebits,
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Chart */}
                    {loading ? (
                        <p
                            style={{
                                textAlign: "center",
                                color: "#64748b",
                                padding: "2rem",
                            }}
                        >
                            Loading chart data...
                        </p>
                    ) : data.length === 0 ? (
                        <div className={styles.empty}>
                            <p>No data available for selected period</p>
                        </div>
                    ) : (
                        <div className={styles.chartContainer}>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={data}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#2a3352"
                                    />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{
                                            paddingTop: "1rem",
                                        }}
                                        contentStyle={{
                                            backgroundColor: "#1a2035",
                                            border: "1px solid #2a3352",
                                            borderRadius: "8px",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="total_debits"
                                        stroke="#fca5a5"
                                        strokeWidth={2}
                                        name="Debits"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="total_credits"
                                        stroke="#86efac"
                                        strokeWidth={2}
                                        name="Credits"
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="net"
                                        stroke="#93c5fd"
                                        strokeWidth={2}
                                        name="Net"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
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
