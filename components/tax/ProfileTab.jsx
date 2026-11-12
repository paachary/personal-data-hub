"use client";

import { useEffect, useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import { errorMessage, toNumberOrNull } from "./format";

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

const DEDUCTION_FIELDS = [
    ["ded_80c", "80C (max 1,50,000, old regime)"],
    ["ded_80d", "80D medical insurance (old regime)"],
    ["ded_80ccd1b", "80CCD(1B) NPS (max 50,000, old regime)"],
    ["ded_hra", "HRA exemption (old regime)"],
    ["ded_24b", "Home loan interest, Section 24(b) (max 2,00,000, old regime)"],
    ["ded_other", "Other Chapter VI-A deductions (old regime)"],
];

const NUMBER_FIELDS = [
    ["salary", "Salary income"],
    ["house_property", "House property income"],
    ["business_income", "Business or professional income"],
    ["tds_tcs", "TDS / TCS already deducted"],
];

function emptyForm() {
    return {
        age_band: "below60",
        regime_choice: "compare",
        has_business_income: false,
        presumptive_44ad: false,
        reminders_enabled: false,
        use_dividend_forecast: false,
        salary: "",
        house_property: "",
        business_income: "",
        tds_tcs: "",
        filing_months_delay: "1",
        deductions: Object.fromEntries(DEDUCTION_FIELDS.map(([key]) => [key, ""])),
    };
}

function fromSaved(profile) {
    if (!profile) return emptyForm();
    return {
        age_band: profile.age_band,
        regime_choice: profile.regime_choice,
        has_business_income: Boolean(profile.has_business_income),
        presumptive_44ad: Boolean(profile.presumptive_44ad),
        reminders_enabled: Boolean(profile.reminders_enabled),
        use_dividend_forecast: Boolean(profile.use_dividend_forecast),
        salary: String(profile.salary ?? ""),
        house_property: String(profile.house_property ?? ""),
        business_income: String(profile.business_income ?? ""),
        tds_tcs: String(profile.tds_tcs ?? ""),
        filing_months_delay: String(profile.filing_months_delay ?? "1"),
        notes: profile.notes || "",
        deductions: Object.fromEntries(
            DEDUCTION_FIELDS.map(([key]) => [key, profile[key] != null ? String(profile[key]) : ""]),
        ),
    };
}

export default function ProfileTab({ fy, onSaved }) {
    const [form, setForm] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        window.electronAPI.tax.profile
            .get(fy)
            .then((profile) => {
                if (active) setForm(fromSaved(profile));
            })
            .catch((err) => {
                if (active) setLoadError(errorMessage(err, "Could not load the tax profile."));
            });
        return () => {
            active = false;
        };
    }, [fy]);

    if (loadError) return <div className={taxStyles.error}>{loadError}</div>;
    if (!form) return <div className={taxStyles.empty}><p>Loading profile…</p></div>;

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const setDeduction = (key, value) =>
        setForm((prev) => ({ ...prev, deductions: { ...prev.deductions, [key]: value } }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        const numbers = {};
        for (const [key] of NUMBER_FIELDS) {
            const n = toNumberOrNull(form[key]);
            if (Number.isNaN(n) || (n !== null && n < 0)) {
                return setError("Income and TDS amounts must be zero or a positive number.");
            }
            numbers[key] = n ?? 0;
        }

        const deductions = {};
        for (const [key] of DEDUCTION_FIELDS) {
            const n = toNumberOrNull(form.deductions[key]);
            if (Number.isNaN(n) || (n !== null && n < 0)) {
                return setError("Deductions must be zero or a positive number.");
            }
            deductions[key] = n ?? 0;
        }

        const months = toNumberOrNull(form.filing_months_delay);
        if (months === null || Number.isNaN(months) || !Number.isInteger(months) || months < 0 || months > 12) {
            return setError("Filing delay must be a whole number of months between 0 and 12.");
        }

        setSaving(true);
        try {
            await window.electronAPI.tax.profile.save({
                fy,
                age_band: form.age_band,
                regime_choice: form.regime_choice,
                has_business_income: form.has_business_income,
                presumptive_44ad: form.presumptive_44ad,
                reminders_enabled: form.reminders_enabled,
                use_dividend_forecast: form.use_dividend_forecast,
                salary: numbers.salary,
                house_property: numbers.house_property,
                business_income: numbers.business_income,
                tds_tcs: numbers.tds_tcs,
                filing_months_delay: months,
                ...deductions,
                notes: form.notes.trim() || null,
            });
            setMessage("Tax profile saved.");
            onSaved?.();
        } catch (err) {
            setError(errorMessage(err, "Could not save the tax profile."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className={taxStyles.error}>{error}</div>}
            {message && <div className={`${taxStyles.banner} ${taxStyles.info}`} role="status">{message}</div>}

            <div className={styles.fields}>
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

                <label className={styles.label}>
                    <input type="checkbox" checked={form.has_business_income}
                        onChange={(e) => set("has_business_income", e.target.checked)} /> Has business or professional income
                </label>

                <label className={styles.label}>
                    <input type="checkbox" checked={form.presumptive_44ad} disabled={!form.has_business_income}
                        onChange={(e) => set("presumptive_44ad", e.target.checked)} /> Presumptive scheme (44AD)
                </label>

                <label className={styles.label}>
                    <input type="checkbox" checked={form.use_dividend_forecast}
                        onChange={(e) => set("use_dividend_forecast", e.target.checked)} /> Forecast dividends from the average of the last two years when none are recorded
                </label>

                <label className={styles.label}>
                    <input type="checkbox" checked={form.reminders_enabled}
                        onChange={(e) => set("reminders_enabled", e.target.checked)} /> Create reminders for advance tax due dates
                </label>
                <p className={taxStyles.warning}>
                    Reminders are stored as to-do items. They are not encrypted, and every local user can see them.
                    They use only generic titles and no amounts.
                </p>

                {NUMBER_FIELDS.map(([key, label]) => (
                    <div className={styles.field} key={key}>
                        <label className={styles.label} htmlFor={`tax-${key}`}>{label} (₹)</label>
                        <input id={`tax-${key}`} className={styles.input} type="number" min="0" step="1"
                            value={form[key]} onChange={(e) => set(key, e.target.value)} />
                    </div>
                ))}

                <div className={styles.field}>
                    <label className={styles.label} htmlFor="tax-delay">Filing delay (months after 1 April)</label>
                    <input id="tax-delay" className={styles.input} type="number" min="0" max="12" step="1"
                        value={form.filing_months_delay} onChange={(e) => set("filing_months_delay", e.target.value)} />
                </div>
            </div>

            <div className={taxStyles.subsection}>
                <h3 className={taxStyles.subsectionTitle}>Deductions (₹)</h3>
                <div className={styles.fields}>
                    {DEDUCTION_FIELDS.map(([key, label]) => (
                        <div className={styles.field} key={key}>
                            <label className={styles.label} htmlFor={`tax-ded-${key}`}>{label}</label>
                            <input id={`tax-ded-${key}`} className={styles.input} type="number" min="0" step="1"
                                value={form.deductions[key]} onChange={(e) => setDeduction(key, e.target.value)} />
                        </div>
                    ))}
                </div>
                <p className={taxStyles.assumptions}>
                    Deductions are used as entered. 80C, 80CCD(1B) and Section 24(b) are capped at the statutory limits. Deductions apply to the old regime only; the new regime ignores them.
                </p>
            </div>

            <div className={styles.field} style={{ marginTop: 16 }}>
                <label className={styles.label} htmlFor="tax-notes">Notes</label>
                <textarea id="tax-notes" className={styles.input} rows={3} value={form.notes}
                    onChange={(e) => set("notes", e.target.value)} />
            </div>

            <div className={styles.actions} style={{ marginTop: 16 }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? "Saving…" : "Save profile"}
                </button>
            </div>
        </form>
    );
}
