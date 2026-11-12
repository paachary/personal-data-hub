"use client";

import styles from "./taxPage.module.css";
import { formatAmount } from "./format";
import { REGIME_LABELS, REGIME_ROWS } from "./overviewSummary";

// The regime with the lower total tax is the cheaper one, and its column is highlighted.
function cheaperRegime(regimes) {
    const entries = Object.entries(regimes).filter(([, r]) => typeof r.totalTax === "number");
    if (entries.length < 2 || entries[0][1].totalTax === entries[1][1].totalTax) return null;
    return entries.reduce((best, current) => (current[1].totalTax < best[1].totalTax ? current : best))[0];
}

export default function ComparisonTable({ regimes }) {
    const keys = Object.keys(regimes);
    const cheaper = cheaperRegime(regimes);

    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col">Item</th>
                        {keys.map((key) => (
                            <th key={key} scope="col" className={styles.num}>
                                {REGIME_LABELS[key] ?? key}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {REGIME_ROWS.map(([label, pick]) => {
                        const isTotal = label === "Total tax";
                        return (
                            <tr key={label} className={isTotal ? styles.totalRow : undefined}>
                                <th scope="row">
                                    {label}
                                </th>
                                {keys.map((key) => {
                                    const value = pick(regimes[key]);
                                    const classes = [
                                        styles.num,
                                        key === cheaper ? styles.bestCol : "",
                                        value === 0 ? styles.dim : "",
                                    ].join(" ");
                                    return (
                                        <td key={key} className={classes}>
                                            {formatAmount(value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
