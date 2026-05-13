"use client";

import { useState } from "react";
import styles from "./finance.module.css";

const ACCOUNT_TYPES = ["Savings", "Current", "NRE", "NRO"];

export default function AccountModal({
    existing = null,
    banks = [],
    userId,
    onSave,
    onClose,
}) {
    const [form, setForm] = useState({
        bank_master_id: existing?.bank_master_id || "",
        account_number: existing?.account_number || "",
        account_type: existing?.account_type || "Savings",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.bank_master_id) return setError("Please select a bank.");

        setSaving(true);
        try {
            if (existing) {
                await window.electronAPI.accounts.update({
                    id: existing.id,
                    ...form,
                });
            } else {
                await window.electronAPI.accounts.add({
                    user_id: userId,
                    ...form,
                });
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
                        {existing ? "Edit Account" : "Add Account"}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.fields}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Bank <span className={styles.required}>*</span>
                        </label>
                        <select
                            className={styles.select}
                            value={form.bank_master_id}
                            onChange={(e) =>
                                set("bank_master_id", e.target.value)
                            }
                        >
                            <option value="">— Select Bank —</option>
                            {banks.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.bank_name} — {b.branch_name}, {b.city}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Account Number
                            </label>
                            <input
                                className={styles.input}
                                value={form.account_number}
                                onChange={(e) =>
                                    set("account_number", e.target.value)
                                }
                                placeholder="Optional"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Account Type</label>
                            <select
                                className={styles.select}
                                value={form.account_type}
                                onChange={(e) =>
                                    set("account_type", e.target.value)
                                }
                            >
                                {ACCOUNT_TYPES.map((t) => (
                                    <option key={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

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
                                : "Add Account"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
