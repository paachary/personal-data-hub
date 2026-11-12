"use client";

import { useState } from "react";
import styles from "./taxPage.module.css";
import SlabTable from "./SlabTable";
import { REGIME_LABELS, isEmptyOverview } from "./overviewSummary";

export default function SlabsTab({ fy, overview }) {
    const [regimeChoice, setRegimeChoice] = useState(null);
    const [showAll, setShowAll] = useState(false);

    if (!overview) {
        return <p className={styles.status}>Calculating…</p>;
    }
    if (isEmptyOverview(overview)) {
        return <p className={styles.status}>No tax data for FY {fy} yet.</p>;
    }

    const regimes = overview.tax.regimes;
    const regime = regimeChoice ?? overview.recommendedRegime;
    const chosen = regimes[regime];
    const slabs = chosen?.slabBreakdown ?? [];

    return (
        <div>
            <div className={styles.segmented} role="group" aria-label="Regime">
                {Object.keys(regimes).map((key) => {
                    const on = key === regime;
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={on}
                            className={`${styles.segment} ${on ? styles.segmentOn : ""}`}
                            onClick={() => setRegimeChoice(key)}
                        >
                            {REGIME_LABELS[key] ?? key}
                        </button>
                    );
                })}
            </div>
            <div className={styles.toggleRow}>
                <label>
                    <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all slabs
                </label>
            </div>
            {slabs.length === 0 ? (
                <p className={styles.status}>No slab breakdown for this regime.</p>
            ) : (
                <SlabTable slabs={slabs} totalTaxable={chosen.taxableIncome?.normal} totalTax={chosen.slabTax} showAll={showAll} />
            )}
        </div>
    );
}
