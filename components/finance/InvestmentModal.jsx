"use client";

import { useState, useEffect } from "react";
import styles from "./finance.module.css";

export default function InvestmentModal({
    existing = null,
    accounts = [],
    userId,
    onSave,
    onClose,
}) {
    const [instrumentTypes, setInstrumentTypes] = useState([]);
    const [investmentTypes, setInvestmentTypes] = useState([]);

    const [form, setForm] = useState({
        investment_ref_id: existing?.investment_ref_id || "",
        account_id: existing?.account_id || "",
        instrument_type_id: existing?.instrument_type_id || "",
        investment_type_id: existing?.investment_type_id || "",
        investment_name: existing?.investment_name || "",
        amount: existing?.amount || "",
        investment_date: existing?.investment_date || "",
        maturity_date: existing?.maturity_date || "",
        interest_rate: existing?.interest_rate ?? "",
        compounding: existing?.compounding || "",
    });

    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        async function load() {
            const [it, ivt] = await Promise.all([
                window.electronAPI.investments.getInstrumentTypes(),
                window.electronAPI.investments.getInvestmentTypes(),
            ]);
            setInstrumentTypes(it);
            setInvestmentTypes(ivt);
        }
        load();
    }, []);

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const isFd =
        instrumentTypes.find((it) => String(it.id) === String(form.instrument_type_id))?.code === "FD";
    // Matured FDs from the current FY can be recorded on add only.
    const allowPastMaturity = isFd && !existing;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.investment_ref_id.trim())
            return setError("Reference ID is required.");
        if (!form.account_id) return setError("Please select an account.");
        if (!form.instrument_type_id)
            return setError("Please select an instrument type.");
        if (!form.investment_type_id)
            return setError("Please select an investment type.");
        if (!form.investment_name.trim())
            return setError("Investment name is required.");
        if (!form.amount || isNaN(form.amount))
            return setError("Valid amount is required.");
        if (!form.investment_date)
            return setError("Investment date is required.");
        if (form.investment_date > today)
            return setError("Investment date cannot be a future date.");
        if (form.maturity_date && form.maturity_date <= today && !allowPastMaturity)
            return setError("Maturity date must be greater than today.");
        if (isFd && form.interest_rate !== "") {
            const rate = Number(form.interest_rate);
            if (!Number.isFinite(rate) || rate < 0 || rate > 30)
                return setError("Interest rate must be between 0 and 30.");
        }

        setSaving(true);
        try {
            const payload = {
                ...form,
                user_id: userId,
                amount: parseFloat(form.amount),
                interest_rate:
                    isFd && form.interest_rate !== "" ? parseFloat(form.interest_rate) : null,
                compounding: isFd && form.compounding ? form.compounding : null,
            };
            if (existing) {
                await window.electronAPI.investments.update({
                    id: existing.id,
                    ...payload,
                });
            } else {
                await window.electronAPI.investments.add(payload);
            }
            onSave();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {existing ? "Edit Investment" : "Add Investment"}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.fields}>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Reference ID{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                value={form.investment_ref_id}
                                onChange={(e) =>
                                    set("investment_ref_id", e.target.value)
                                }
                                placeholder="FD receipt / Folio no."
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Investment Name{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                value={form.investment_name}
                                onChange={(e) =>
                                    set("investment_name", e.target.value)
                                }
                                placeholder="SBI FD - 2yr"
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>
                            Bank Account{" "}
                            <span className={styles.required}>*</span>
                        </label>
                        <select
                            className={styles.select}
                            value={form.account_id}
                            onChange={(e) => set("account_id", e.target.value)}
                        >
                            <option value="">— Select Account —</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.bank_name} — {a.branch_name} (
                                    {a.account_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Instrument Type{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <select
                                className={styles.select}
                                value={form.instrument_type_id}
                                onChange={(e) =>
                                    set("instrument_type_id", e.target.value)
                                }
                            >
                                <option value="">— Select —</option>
                                {instrumentTypes.map((it) => (
                                    <option key={it.id} value={it.id}>
                                        {it.code} — {it.description}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Investment Type{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <select
                                className={styles.select}
                                value={form.investment_type_id}
                                onChange={(e) =>
                                    set("investment_type_id", e.target.value)
                                }
                            >
                                <option value="">— Select —</option>
                                {investmentTypes.map((it) => (
                                    <option key={it.id} value={it.id}>
                                        {it.code} — {it.description}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Amount (₹){" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.amount}
                                onChange={(e) => set("amount", e.target.value)}
                                placeholder="50000"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Investment Date{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                type="date"
                                max={today} // ← cap at today
                                value={form.investment_date}
                                onChange={(e) =>
                                    set("investment_date", e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>
                            Maturity Date{" "}
                            <span className={styles.subtitle}>
                                (leave blank if no maturity)
                            </span>
                        </label>
                        <input
                            className={styles.input}
                            type="date"
                            min={allowPastMaturity ? undefined : today} // ← must be future (FD add may be past)
                            value={form.maturity_date}
                            onChange={(e) =>
                                set("maturity_date", e.target.value)
                            }
                        />
                    </div>

                    {isFd && (
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    Interest rate (% p.a.){" "}
                                    <span className={styles.subtitle}>(optional)</span>
                                </label>
                                <input
                                    className={styles.input}
                                    type="number"
                                    min="0"
                                    max="30"
                                    step="0.01"
                                    value={form.interest_rate}
                                    onChange={(e) => set("interest_rate", e.target.value)}
                                    placeholder="7.10"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    Interest type (Cumulative / Payout){" "}
                                    <span className={styles.subtitle}>(optional)</span>
                                </label>
                                <select
                                    className={styles.select}
                                    value={form.compounding}
                                    onChange={(e) => set("compounding", e.target.value)}
                                >
                                    <option value="">— Select —</option>
                                    <option value="cumulative">Cumulative</option>
                                    <option value="payout">Payout</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {error && <p className={styles.error}>{error}</p>}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : existing
                                ? "Update"
                                : "Add Investment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
