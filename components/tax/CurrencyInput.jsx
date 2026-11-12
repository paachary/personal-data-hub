"use client";

import { formatAmountInput } from "@/lib/tax/fieldUtils";
import styles from "./taxPage.module.css";

export default function CurrencyInput({ id, value, onChange, invalid = false, describedBy, placeholder = "0" }) {
    return (
        <div className={`${styles.currency} ${invalid ? styles.currencyInvalid : ""}`}>
            <span className={styles.prefix} aria-hidden="true">₹</span>
            <input
                id={id}
                className={styles.currencyInput}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(e) => onChange(formatAmountInput(e.target.value))}
            />
        </div>
    );
}
