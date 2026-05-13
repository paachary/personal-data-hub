"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "@/components/finance/finance.module.css";

export default function SettingsInstrumentTypes() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | "add" | item
    const [form, setForm] = useState({ code: "", description: "" });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const data = await window.electronAPI.investments.getInstrumentTypes();
        setTypes(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openAdd = () => {
        setForm({ code: "", description: "" });
        setError("");
        setModal("add");
    };

    const openEdit = (item) => {
        setForm({ code: item.code, description: item.description });
        setError("");
        setModal(item);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.code.trim()) return setError("Code is required.");
        if (!form.description.trim())
            return setError("Description is required.");

        setSaving(true);
        try {
            if (modal === "add") {
                await window.electronAPI.investments.addInstrumentType({
                    code: form.code.toUpperCase().trim(),
                    description: form.description.trim(),
                });
            } else {
                await window.electronAPI.investments.updateInstrumentType({
                    id: modal.id,
                    code: form.code.toUpperCase().trim(),
                    description: form.description.trim(),
                });
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
        if (
            !confirm(
                "Delete this instrument type? This may affect existing investments."
            )
        )
            return;
        await window.electronAPI.investments.deleteInstrumentType(id);
        load();
    };

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Instrument Types</h2>
                    <p className={styles.subtitle}>
                        Manage investment instruments
                    </p>
                </div>
                <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={openAdd}
                >
                    + Add Instrument Type
                </button>
            </div>

            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : types.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📊</div>
                    <p>No instrument types found.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types.map((t, i) => (
                                <tr key={t.id}>
                                    <td>{i + 1}</td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {t.code}
                                        </span>
                                    </td>
                                    <td>{t.description}</td>
                                    <td>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                onClick={() => openEdit(t)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                onClick={() =>
                                                    handleDelete(t.id)
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

            {/* ── Modal ── */}
            {modal && (
                <div className={styles.overlay} onClick={() => setModal(null)}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {modal === "add"
                                    ? "Add Instrument Type"
                                    : "Edit Instrument Type"}
                            </h2>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setModal(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSave} className={styles.fields}>
                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Code{" "}
                                        <span className={styles.required}>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={form.code}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                code: e.target.value,
                                            }))
                                        }
                                        placeholder="FD, MF, LIC..."
                                        maxLength={10}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Description{" "}
                                        <span className={styles.required}>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={form.description}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                description: e.target.value,
                                            }))
                                        }
                                        placeholder="Fixed Deposit..."
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
