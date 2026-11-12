"use client";

import styles from "./taxPage.module.css";
import { formatAmount } from "./format";

export default function AssumptionsTab({ fy, overview }) {
    if (!overview) {
        return <p className={styles.status}>Calculating…</p>;
    }

    const notes = overview.notes ?? [];
    const banners = [];
    if (overview.profile?.presumptive_44ad) {
        banners.push("Presumptive business income (44AD): the full tax is due in one instalment on 15 March.");
    }
    if (overview.dividendForecast) {
        const { amount, basis } = overview.dividendForecast;
        banners.push(
            `Dividend income of ${formatAmount(amount)} is forecast from ${basis
                .map((b) => `FY ${b.fy} (${formatAmount(b.amount)})`)
                .join(" and ")}. Recorded dividends for FY ${fy} override this forecast.`,
        );
    }

    return (
        <div>
            {banners.length > 0 && (
                <div className={styles.bannerStack}>
                    {banners.map((text) => (
                        <div key={text} className={`${styles.banner} ${styles.info}`}>{text}</div>
                    ))}
                </div>
            )}
            {notes.length === 0 ? (
                <p className={styles.status}>No assumptions to show.</p>
            ) : (
                <ul className={styles.assumptions}>
                    {notes.map((note) => (
                        <li key={note} className={/verify/i.test(note) ? styles.assumptionWarn : undefined}>
                            {note}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
