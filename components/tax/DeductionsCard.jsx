"use client";

import { countedDeductions, formatIndian } from "@/lib/tax/fieldUtils";
import DeductionField from "./DeductionField";
import styles from "./taxPage.module.css";

const DEDUCTION_FIELDS = [
    ["ded_80c", "80C"],
    ["ded_80d", "80D medical insurance"],
    ["ded_80ccd1b", "80CCD(1B) NPS"],
    ["ded_hra", "HRA exemption"],
    ["ded_24b", "Home loan interest, 24(b)"],
    ["ded_other", "Other Chapter VI-A"],
];

export default function DeductionsCard({ form, set }) {
    return (
        <>
            <div className={`${styles.sectionLabel} ${styles.spanAll}`}>
                Deductions <span className={styles.badge}>Old regime only</span>
            </div>
            {DEDUCTION_FIELDS.map(([key, label]) => (
                <DeductionField key={key} fieldKey={key} id={`tax-ded-${key}`} label={label}
                    value={form[key]} onChange={(v) => set(key, v)} />
            ))}
            <div className={`${styles.footerTotal} ${styles.spanAll}`}>
                <span>Total deductions counted</span>
                <span className={styles.num}>₹{formatIndian(countedDeductions(form))}</span>
            </div>
        </>
    );
}
