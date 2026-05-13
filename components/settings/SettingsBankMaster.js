"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "@/components/finance/finance.module.css";

export default function SettingsBankMaster() {
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({
        bank_name: "",
        branch_name: "",
        city: "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const data = await window.electronAPI.banks.getAll(); // ← was getAllBanks
        setBanks(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setForm({ bank_name: "", branch_name: "", city: "" });
        setError("");
        setModal("add");
    };

    const openEdit = (bank) => {
        setForm({
            bank_name: bank.bank_name,
            branch_name: bank.branch_name,
            city: bank.city,
        });
        setError("");
        setModal(bank);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.bank_name.trim()) return setError("Bank name is required.");
        if (!form.branch_name.trim())
            return setError("Branch name is required.");
        if (!form.city.trim()) return setError("City is required.");

        setSaving(true);
        try {
            if (modal === "add") {
                await window.electronAPI.banks.add(form); // ← was addBank
            } else {
                await window.electronAPI.banks.update({
                    id: modal.id,
                    ...form,
                }); // ← was updateBank
            }
            setModal(null);
            load();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this bank? This cannot be undone.")) return;
        await window.electronAPI.banks.delete(id); // ← was deleteBank
        load();
    };

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Bank Master</h2>
                    <p className={styles.subtitle}>
                        Manage bank branches available system-wide
                    </p>
                </div>
                <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={openAdd}
                >
                    + Add Bank
                </button>
            </div>

            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : banks.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🏛️</div>
                    <p>No banks added yet.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Bank Name</th>
                                <th>Branch</th>
                                <th>City</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {banks.map((b, i) => (
                                <tr key={b.id}>
                                    <td>{i + 1}</td>
                                    <td>{b.bank_name}</td>
                                    <td>{b.branch_name}</td>
                                    <td>{b.city}</td>
                                    <td>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                onClick={() => openEdit(b)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                onClick={() =>
                                                    handleDelete(b.id)
                                                }
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <div className={styles.overlay} onClick={() => setModal(null)}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {modal === "add" ? "Add Bank" : "Edit Bank"}
                            </h2>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSave} className={styles.fields}>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    Bank Name{" "}
                                    <span className={styles.required}>*</span>
                                </label>
                                <input
                                    className={styles.input}
                                    value={form.bank_name}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            bank_name: e.target.value,
                                        }))
                                    }
                                    placeholder="State Bank of India"
                                />
                            </div>
                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Branch{" "}
                                        <span className={styles.required}>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={form.branch_name}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                branch_name: e.target.value,
                                            }))
                                        }
                                        placeholder="Main Branch"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        City{" "}
                                        <span className={styles.required}>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={form.city}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                city: e.target.value,
                                            }))
                                        }
                                        placeholder="Mumbai"
                                    />
                                </div>
                            </div>

                            {error && <p className={styles.error}>{error}</p>}

                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={`${styles.btn} ${styles.btnSecondary}`}
                                    onClick={() => setModal(null)}
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
                                        : modal === "add"
                                        ? "Add"
                                        : "Update"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
