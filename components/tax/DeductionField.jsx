"use client";

import { capStatus, formatIndian, parseAmount } from "@/lib/tax/fieldUtils";
import CurrencyInput from "./CurrencyInput";
import styles from "./taxPage.module.css";

export default function DeductionField({ fieldKey, id, label, value, onChange, dimmed = false }) {
    const { value: amount, valid } = parseAmount(value);
    const status = capStatus(fieldKey, valid && amount !== null ? amount : 0);
    const helperId = `${id}-helper`;
    const hasCap = status.cap !== null;

    let helper = "";
    if (!valid) helper = "Enter a positive amount";
    else if (status.exceeded) helper = `Over the cap. Counted as ${formatIndian(status.cap)}`;

    let fillClass = styles.progressBar;
    if (status.exceeded || status.ratio >= 1) fillClass = `${styles.progressBar} ${styles.progressDanger}`;
    else if (status.ratio >= 0.9) fillClass = `${styles.progressBar} ${styles.progressWarn}`;

    return (
        <div className={`${styles.field} ${dimmed ? styles.dimmed : ""}`}>
            <label className={styles.label} htmlFor={id}>{label}</label>
            <CurrencyInput id={id} value={value} onChange={onChange} invalid={!valid} describedBy={helper ? helperId : undefined} />
            {hasCap && (
                <div className={styles.progressWrap}>
                    <div className={styles.progress} aria-hidden="true">
                        <div className={fillClass} style={{ width: `${status.ratio * 100}%` }} />
                    </div>
                    <p className={styles.progressCaption}>
                        ₹{formatIndian(status.counted)} / cap ₹{formatIndian(status.cap)}
                    </p>
                </div>
            )}
            {helper && (
                <div id={helperId} className={`${styles.helper} ${styles.overCap}`}>
                    {helper}
                </div>
            )}
        </div>
    );
}
