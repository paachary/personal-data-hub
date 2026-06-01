"use client";

import { useMemo } from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import styles from "./finance.module.css";

// Fixed palette — one colour per instrument slot (up to 10)
const COLOURS = [
    "#3b82f6", // blue   — FD
    "#10b981", // green  — MF
    "#f59e0b", // amber  — LIC
    "#8b5cf6", // violet — NPS
    "#ec4899", // pink   — MI
    "#06b6d4", // cyan   — ELSS
    "#f97316", // orange — PPF
    "#a3e635", // lime   — BONDS
    "#e11d48", // rose
    "#6366f1", // indigo
];

const fmtINR = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const { name, value, payload: p } = payload[0];
    return (
        <div className={styles.chartTooltip}>
            <p className={styles.chartTooltipName}>{name}</p>
            <p className={styles.chartTooltipValue}>{fmtINR(value)}</p>
            <p className={styles.chartTooltipPct}>{p.pct}%</p>
        </div>
    );
}

export default function InvestmentDistributionChart({ investments }) {
    const chartData = useMemo(() => {
        const map = {};
        for (const inv of investments) {
            const key = inv.instrument_code || "Unknown";
            const desc = inv.instrument_desc || key;
            if (!map[key]) map[key] = { name: key, desc, value: 0 };
            map[key].value += inv.amount || 0;
        }

        const total = Object.values(map).reduce((s, d) => s + d.value, 0);
        return Object.values(map)
            .sort((a, b) => b.value - a.value)
            .map((d) => ({
                ...d,
                pct: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0",
            }));
    }, [investments]);

    if (chartData.length === 0) {
        return (
            <div className={styles.chartContainer}>
                <p className={styles.chartEmpty}>
                    No investment data to display.
                </p>
            </div>
        );
    }

    return (
        <div className={styles.chartContainer}>
            <h3 className={styles.chartTitle}>Distribution by Instrument</h3>
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={entry.name}
                                fill={COLOURS[index % COLOURS.length]}
                                stroke="transparent"
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        formatter={(value) => (
                            <span className={styles.chartLegendLabel}>
                                {value}
                            </span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
