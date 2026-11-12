"use client";

import styles from "./taxPage.module.css";
import IncomeCard from "./IncomeCard";
import DeductionsCard from "./DeductionsCard";

const AGE_OPTIONS = [
    { value: "below60", label: "Below 60" },
    { value: "senior", label: "60 to 79 (senior)" },
    { value: "superSenior", label: "80 and above (super senior)" },
];

const REGIME_OPTIONS = [
    { value: "compare", label: "Compare old and new" },
    { value: "old", label: "Old regime" },
    { value: "new", label: "New regime" },
];

const REMINDER_NOTE =
    "Reminders are stored as to-do items. They are not encrypted, and every local user can see them. They use only generic titles and no amounts.";

const DIVIDEND_NOTE =
    "Forecast from the average of the last two years when none are recorded. Recorded dividends for the year override this forecast.";

export default function InputsTab({ form, set, otherIncome, validationError }) {
    return (
        <div>
            <div className={styles.inputsGrid}>
                <IncomeCard form={form} set={set} otherIncome={otherIncome} />
                <DeductionsCard form={form} set={set} />
            </div>

            <div className={styles.optionsRow}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="tax-age">Age band</label>
                    <select id="tax-age" className={styles.select} value={form.age_band}
                        onChange={(e) => set("age_band", e.target.value)}>
                        {AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <div className={styles.field}>
                    <label className={styles.label} htmlFor="tax-regime">Regime</label>
                    <select id="tax-regime" className={styles.select} value={form.regime_choice}
                        onChange={(e) => set("regime_choice", e.target.value)}>
                        {REGIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <label className={styles.check}>
                    <input type="checkbox" checked={form.has_business_income}
                        onChange={(e) => set("has_business_income", e.target.checked)} />
                    Has business or professional income
                </label>

                <label className={styles.check}>
                    <input type="checkbox" checked={form.presumptive_44ad} disabled={!form.has_business_income}
                        onChange={(e) => set("presumptive_44ad", e.target.checked)} />
                    Presumptive scheme (44AD)
                </label>

                <label className={styles.check} title={DIVIDEND_NOTE}>
                    <input type="checkbox" checked={form.use_dividend_forecast}
                        onChange={(e) => set("use_dividend_forecast", e.target.checked)} />
                    Forecast dividends when none recorded
                </label>

                <label className={styles.check}>
                    <input type="checkbox" checked={form.reminders_enabled}
                        onChange={(e) => set("reminders_enabled", e.target.checked)} />
                    Create advance tax reminders
                    <span className={styles.info} role="img" title={REMINDER_NOTE} aria-label={REMINDER_NOTE}>i</span>
                </label>
            </div>

            <details className={styles.notes}>
                <summary>Notes</summary>
                <textarea id="tax-notes" aria-label="Notes" className={styles.textarea} rows={3} value={form.notes}
                    onChange={(e) => set("notes", e.target.value)} />
            </details>

            {validationError && <p role="alert" className={styles.statusError}>{validationError}</p>}
        </div>
    );
}
