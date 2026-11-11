"use client";

import { useEffect, useState } from "react";
import styles from "./DashboardOverview.module.css";

function currentFy(now = new Date()) {
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function formatInr(amount) {
    return `₹${Math.round(Number(amount) || 0).toLocaleString("en-IN")}`;
}

export default function AdvanceTaxCard() {
    const [state, setState] = useState({ loading: true, text: "—", detail: "" });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await window.electronAPI.tax.getOverview(currentFy());
                if (cancelled) return;
                const schedule = data?.schedule;
                if (!schedule?.applicable) {
                    setState({ loading: false, text: "Not applicable", detail: schedule?.reason ?? "" });
                    return;
                }
                const today = new Date().toISOString().slice(0, 10);
                const next = (schedule.instalments ?? []).find(
                    (i) => i.shortfall > 0 && i.dueDate >= today
                );
                if (!next) {
                    setState({ loading: false, text: "No pending instalment", detail: "" });
                    return;
                }
                setState({
                    loading: false,
                    text: `Due ${next.dueDate}`,
                    detail: `Shortfall ${formatInr(next.shortfall)}`,
                });
            } catch (err) {
                if (!cancelled) {
                    setState({ loading: false, text: "Unavailable", detail: err?.message ?? "" });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.statCard}>
            <span className={styles.cardIcon} aria-hidden="true">🧾</span>
            <div>
                <p className={styles.cardLabel}>Advance tax ({currentFy()})</p>
                <p className={styles.cardValue}>{state.loading ? "—" : state.text}</p>
                {state.detail && <p className={styles.cardLabel}>{state.detail}</p>}
            </div>
        </div>
    );
}
