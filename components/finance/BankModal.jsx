"use client";

import { useState } from "react";
import styles from "./finance.module.css";

export default function BankModal({ existing = null, onSave, onClose }) {
    const [form, setForm] = useState({
        bank_name: existing?.bank_name || "",
        branch_name: existing?.branch_name || "",
        city: existing?.city || "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.bank_name.trim()) return setError("Bank name is required.");
        if (!form.branch_name.trim())
            return setError("Branch name is required.");
        if (!form.city.trim()) return setError("City is required.");

        setSaving(true);
        try {
            if (existing) {
                await window.electronAPI.banks.update({
                    id: existing.id,
                    ...form,
                });
            } else {
                await window.electronAPI.banks.add(form);
            }
            onSave();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {existing ? "Edit Bank" : "Add Bank"}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.fields}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Bank Name <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            value={form.bank_name}
                            onChange={(e) => set("bank_name", e.target.value)}
                            placeholder="SBI, HDFC, ICICI..."
                        />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Branch Name{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                value={form.branch_name}
                                onChange={(e) =>
                                    set("branch_name", e.target.value)
                                }
                                placeholder="Andheri West"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                City <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                value={form.city}
                                onChange={(e) => set("city", e.target.value)}
                                placeholder="Mumbai"
                            />
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
                                : "Add Bank"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
