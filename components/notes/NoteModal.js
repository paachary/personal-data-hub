"use client";

import { useState, useEffect } from "react";
import styles from "./NoteModal.module.css";
import { FieldInput } from "@/components/vault/FieldRenderer";
import { NOTE_SCHEMA } from "@/constants/vaultSchemas";
import { validatePassword } from "@/constants/passwordRules";

function isPasswordKey(key) {
    return key?.toLowerCase().includes("password");
}

function validatePasswordAttributes(attributes) {
    if (!attributes?.length) return null;
    for (const attr of attributes) {
        if (isPasswordKey(attr.key) && attr.value) {
            const errors = validatePassword(attr.value); // ← now array
            if (errors.length > 0)
                return `Attribute "${attr.key}": ${errors[0]}`;
        }
    }
    return null;
}

function buildEmpty() {
    return NOTE_SCHEMA.fields.reduce((acc, f) => {
        acc[f.name] = f.type === "kvlist" ? [] : "";
        return acc;
    }, {});
}

// ── Password-aware KV List ────────────────────────────────

function KvListInput({ value = [], onChange }) {
    const [showMap, setShowMap] = useState({});

    const update = (idx, field, val) => {
        const next = value.map((item, i) =>
            i === idx ? { ...item, [field]: val } : item
        );
        onChange(next);
    };

    const add = () => onChange([...value, { key: "", value: "" }]);
    const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

    return (
        <div className={styles.kvList}>
            {value.map((item, idx) => {
                const masked = isPasswordKey(item.key);
                const show = showMap[idx] ?? false;
                return (
                    <div key={idx} className={styles.kvRow}>
                        <input
                            className={styles.kvKey}
                            placeholder="Key"
                            value={item.key}
                            onChange={(e) => update(idx, "key", e.target.value)}
                        />
                        <div className={styles.kvValueWrapper}>
                            <input
                                className={`${styles.kvValue} ${
                                    masked ? styles.kvPassword : ""
                                }`}
                                placeholder="Value"
                                type={masked && !show ? "password" : "text"}
                                value={item.value}
                                onChange={(e) =>
                                    update(idx, "value", e.target.value)
                                }
                            />
                            {masked && (
                                <button
                                    type="button"
                                    className={styles.kvToggle}
                                    onClick={() =>
                                        setShowMap((prev) => ({
                                            ...prev,
                                            [idx]: !prev[idx],
                                        }))
                                    }
                                >
                                    {show ? "🙈" : "👁️"}
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            className={styles.kvRemove}
                            onClick={() => remove(idx)}
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            <button type="button" className={styles.kvAdd} onClick={add}>
                + Add Attribute
            </button>
        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────

export default function NoteModal({ existing = null, onSave, onClose }) {
    const [data, setData] = useState(existing?.data ?? buildEmpty());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        if (!data.label?.trim()) {
            setError("Title is required.");
            return;
        }

        // ← validate password attributes
        const attrError = validatePasswordAttributes(data.attributes);
        if (attrError) {
            setError(attrError);
            return;
        }

        setSaving(true);
        setError("");
        try {
            await onSave(data);
        } catch {
            setError("Failed to save note.");
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {existing ? "Edit Note" : "Add Note"}
                    </h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {NOTE_SCHEMA.fields.map((field) => (
                        <div key={field.name} className={styles.field}>
                            <label className={styles.label}>
                                {field.label}
                                {field.required && (
                                    <span className={styles.required}> *</span>
                                )}
                            </label>

                            {/* ← use custom KvListInput for kvlist so we get password masking */}
                            {field.type === "kvlist" ? (
                                <KvListInput
                                    value={data[field.name]}
                                    onChange={(val) =>
                                        setData((prev) => ({
                                            ...prev,
                                            [field.name]: val,
                                        }))
                                    }
                                />
                            ) : (
                                <FieldInput
                                    field={field}
                                    value={data[field.name]}
                                    onChange={(val) =>
                                        setData((prev) => ({
                                            ...prev,
                                            [field.name]: val,
                                        }))
                                    }
                                />
                            )}
                        </div>
                    ))}

                    {error && <p className={styles.error}>{error}</p>}

                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            onClick={onClose}
                            disabled={saving}
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
                                : "Add Note"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
