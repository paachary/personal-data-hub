"use client";

import CurrencyInput from "./CurrencyInput";
import { formatAmount } from "./format";
import styles from "./taxPage.module.css";

const INCOME_FIELDS = [
    ["salary", "Salary income"],
    ["house_property", "House property income"],
    ["business_income", "Business or professional income"],
    ["tds_tcs", "TDS / TCS already deducted"],
];

export default function IncomeCard({ form, set, otherIncome }) {
    return (
        <>
            <div className={`${styles.sectionLabel} ${styles.spanAll}`}>Income</div>
            {INCOME_FIELDS.map(([key, label]) => (
                <div className={styles.field} key={key}>
                    <label className={styles.label} htmlFor={`tax-${key}`}>{label}</label>
                    <CurrencyInput id={`tax-${key}`} value={form[key]} onChange={(v) => set(key, v)} />
                </div>
            ))}
            <div className={styles.field}>
                <span className={styles.label}>Other income (auto)</span>
                <div className={styles.readonlyValue}>{formatAmount(otherIncome)}</div>
                <div className={styles.helper}>Interest and dividends, from Other Income</div>
            </div>
            <div className={styles.field}>
                <label className={styles.label} htmlFor="tax-filing-delay">Filing delay (months)</label>
                <input id="tax-filing-delay" className={`${styles.input} ${styles.narrow}`} type="text" inputMode="numeric"
                    autoComplete="off" value={form.filing_months_delay}
                    onChange={(e) => set("filing_months_delay", e.target.value)} />
                <div className={styles.helper}>Months after 1 April, 0 to 12</div>
            </div>
        </>
    );
}
