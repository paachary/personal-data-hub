"use client";

import { useState, useEffect } from "react";
import styles from "./DashboardOverview.module.css";
import { DASHBOARD_STATS } from "@/constants/sections";

export default function DashboardOverview({ userId }) {
    const [counts, setCounts] = useState(
        Object.fromEntries(DASHBOARD_STATS.map(({ id }) => [id, "—"]))
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadCounts() {
            try {
                const [passwords, notes, todos, banks, accounts, investments] =
                    await Promise.allSettled([
                        window.electronAPI.vault.getAll(),
                        window.electronAPI.notes.getAll(),
                        window.electronAPI.todos.getAll(),
                        window.electronAPI.banks.getAll(),
                        window.electronAPI.accounts.getByUser(userId),
                        window.electronAPI.investments.getByUser(userId), // ← use prop
                    ]);

                setCounts({
                    passwords: passwords.value?.entries?.length ?? "—",
                    notes: notes.value?.notes?.length ?? "—",
                    todos:
                        todos.value?.todos?.filter(
                            (t) => t.status === "pending"
                        ).length ?? "—",

                    banks:
                        banks.status === "fulfilled" &&
                        Array.isArray(banks.value)
                            ? banks.value.length
                            : banks.status === "fulfilled"
                            ? banks.value?.banks?.length ?? "—"
                            : `ERR: ${banks.reason?.message}`,

                    accounts:
                        accounts.status === "fulfilled" &&
                        Array.isArray(accounts.value)
                            ? accounts.value.length
                            : accounts.status === "fulfilled"
                            ? accounts.value?.accounts?.length ?? "—"
                            : `ERR: ${accounts.reason?.message}`,
                    investments:
                        investments.status === "fulfilled" &&
                        Array.isArray(investments.value)
                            ? investments.value.length
                            : `ERR: ${investments.reason?.message}`,
                });
            } catch (e) {
                setDebug(`ERROR: ${e?.message}\n${e?.stack}`);
            } finally {
                setLoading(false);
            }
        }

        if (userId) loadCounts(); // ← only run when userId is available
    }, [userId]); // ← depend on userId

    return (
        <>
            <section className={styles.cardGrid}>
                {DASHBOARD_STATS.map(({ id, icon, label }) => (
                    <div key={id} className={styles.statCard}>
                        <div className={styles.cardIcon}>{icon}</div>
                        <div>
                            <p className={styles.cardLabel}>{label}</p>
                            <p className={styles.cardValue}>
                                {loading ? (
                                    <span className={styles.shimmer}>···</span>
                                ) : (
                                    counts[id]
                                )}
                            </p>
                        </div>
                    </div>
                ))}
            </section>

            <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Recent Activity</h2>
                <div className={styles.emptyState}>
                    <p>No recent activity yet.</p>
                    <p className={styles.emptyHint}>
                        Start by adding entries from the sidebar.
                    </p>
                </div>
            </section>
        </>
    );
}
