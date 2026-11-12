"use client";

import { capStatus, formatIndian, parseAmount } from "@/lib/tax/fieldUtils";
import CurrencyInput from "./CurrencyInput";
import styles from "./taxPage.module.css";

export default function DeductionField({ fieldKey, id, label, value, onChange }) {
    const { value: amount, valid } = parseAmount(value);
    const status = capStatus(fieldKey, valid && amount !== null ? amount : 0);
    const helperId = `${id}-helper`;
    const hasCap = status.cap !== null;

    let helper = "";
    if (!valid) helper = "Enter a positive amount";
    else if (status.exceeded) helper = `Over the cap. Counted as ${formatIndian(status.cap)}`;
    else if (hasCap) helper = `${formatIndian(status.counted)} / cap ${formatIndian(status.cap)}`;

    return (
        <div className={styles.field}>
            <label className={styles.label} htmlFor={id}>{label}</label>
            <CurrencyInput id={id} value={value} onChange={onChange} invalid={!valid} describedBy={helper ? helperId : undefined} />
            {hasCap && (
                <div className={styles.progress} aria-hidden="true">
                    <div className={`${styles.progressBar} ${status.exceeded ? styles.overCap : ""}`}
                        style={{ width: `${status.ratio * 100}%` }} />
                </div>
            )}
            {helper && (
                <div id={helperId} className={`${styles.helper} ${status.exceeded || !valid ? styles.overCap : ""}`}>
                    {helper}
                </div>
            )}
        </div>
    );
}
