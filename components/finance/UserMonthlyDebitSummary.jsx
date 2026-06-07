"use client";

import { useMemo } from "react";
import styles from "@/components/finance/finance.module.css";

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

export default function UserMonthlyDebitSummary({ data }) {
    // Aggregate SIP investments by user and bank
    const userBankSummary = useMemo(() => {
        const userBankMap = {};

        data.forEach((inv) => {
            const key = `${inv.user_id}_${inv.bank_id}`;
            if (!userBankMap[key]) {
                userBankMap[key] = {
                    user_id: inv.user_id,
                    first_name: inv.first_name,
                    last_name: inv.last_name,
                    username: inv.username,
                    bank_id: inv.bank_id,
                    bank_name: inv.bank_name,
                    total: 0,
                    count: 0,
                };
            }
            userBankMap[key].total += inv.amount || 0;
            userBankMap[key].count += 1;
        });

        // Convert to array and sort by bank name, then by total descending
        return Object.values(userBankMap).sort((a, b) => {
            if (a.bank_name !== b.bank_name) {
                return a.bank_name.localeCompare(b.bank_name);
            }
            return b.total - a.total;
        });
    }, [data]);

    const grandTotal = useMemo(
        () => userBankSummary.reduce((sum, item) => sum + item.total, 0),
        [userBankSummary],
    );

    if (data.length === 0) {
        return (
            <div className={styles.empty}>
                <p>No SIP investments found.</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Bank</th>
                        <th>Total Monthly Debit</th>
                        <th style={{ textAlign: "center" }}>
                            No. of SIP Investments
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {userBankSummary.map((item) => (
                        <tr key={`${item.user_id}_${item.bank_id}`}>
                            <td>
                                {item.first_name} {item.last_name}{" "}
                                <span className={styles.cardBadge}>
                                    @{item.username}
                                </span>
                            </td>
                            <td>
                                <div>{item.bank_name}</div>
                            </td>
                            <td>{fmt(item.total)}</td>
                            <td style={{ textAlign: "center" }}>
                                {item.count}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td
                            colSpan={2}
                            style={{
                                textAlign: "right",
                                fontWeight: 600,
                                color: "#94a3b8",
                                padding: "0.75rem 1rem",
                            }}
                        >
                            Grand Total Monthly Debit
                        </td>
                        <td
                            style={{
                                fontWeight: 700,
                                color: "#e2e8f0",
                                padding: "0.75rem 1rem",
                            }}
                        >
                            {fmt(grandTotal)}
                        </td>
                        <td />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
