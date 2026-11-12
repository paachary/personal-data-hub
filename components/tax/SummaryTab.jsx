"use client";

import styles from "./taxPage.module.css";
import KpiCards from "./KpiCards";
import ComparisonTable from "./ComparisonTable";
import { isEmptyOverview } from "./overviewSummary";

export default function SummaryTab({ fy, overview, summary }) {
    if (!overview) {
        return <p className={styles.status}>Calculating…</p>;
    }
    if (isEmptyOverview(overview)) {
        return (
            <div className={styles.status}>
                <p>No tax data for FY {fy} yet.</p>
                <p>Save your tax profile and add income, payments or gains to see an estimate.</p>
            </div>
        );
    }
    return (
        <div>
            <KpiCards overview={overview} summary={summary} />
            <h3 className={styles.sectionLabel}>Old vs new regime</h3>
            <ComparisonTable regimes={overview.tax.regimes} />
        </div>
    );
}
