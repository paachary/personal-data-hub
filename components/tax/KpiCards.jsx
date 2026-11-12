"use client";

import styles from "./taxPage.module.css";
import { formatAmount } from "./format";

export default function KpiCards({ overview, summary }) {
    const chosen = overview.tax.regimes[overview.recommendedRegime];
    const hasSaving = summary.savingText !== null;

    return (
        <div className={styles.kpis}>
            <div className={`${styles.kpi} ${styles.kpiAccent}`}>
                <div className={styles.kpiLabel}>Recommended regime</div>
                <div className={styles.kpiValue}>{summary.recommendedLabel}</div>
                {hasSaving && <div className={styles.kpiSub}>Saves {summary.savingText}</div>}
            </div>
            <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Total tax liability</div>
                <div className={styles.kpiValue}>{summary.totalTaxText}</div>
            </div>
            <div className={styles.kpi}>
                <div className={styles.kpiLabel}>TDS / TCS credited</div>
                <div className={styles.kpiValue}>{formatAmount(chosen?.tdsTcs)}</div>
            </div>
            <div className={`${styles.kpi} ${styles.kpiEmphasis}`}>
                <div className={styles.kpiLabel}>Net payable</div>
                <div className={styles.kpiValue}>{summary.payableText}</div>
            </div>
        </div>
    );
}
