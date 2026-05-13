"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./EntryModal.module.css";
import { FieldInput } from "./FieldRenderer";
import { VAULT_SCHEMAS, VAULT_CATEGORY_LIST } from "@/constants/vaultSchemas";

function buildEmptyData(schema) {
    return schema.fields.reduce((acc, f) => {
        acc[f.name] = f.type === "list" || f.type === "kvlist" ? [] : "";
        return acc;
    }, {});
}

export default function EntryModal({ existing = null, onSave, onClose }) {
    const [type, setType] = useState(existing?.type ?? "bank");
    const schema = VAULT_SCHEMAS[type];
    const [fieldErrors, setFieldErrors] = useState({});

    const [data, setData] = useState(
        existing ? existing.data : buildEmptyData(schema)
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleValidationError = useCallback((fieldName, errors) => {
        setFieldErrors((prev) => {
            const existing = prev[fieldName];
            const existingKey = existing ? existing.join("|") : "";
            const newKey = errors ? errors.join("|") : "";
            if (existingKey === newKey) return prev; // ← no change, skip re-render
            return { ...prev, [fieldName]: errors };
        });
    }, []);

    // Reset data when type changes (only for new entries)
    useEffect(() => {
        if (!existing) setData(buildEmptyData(VAULT_SCHEMAS[type]));
    }, [type, existing]);

    const handleFieldChange = (name, value) => {
        setData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        // ← check array length instead of null/undefined
        const hasPasswordErrors = Object.values(fieldErrors).some((errs) =>
            Array.isArray(errs)
                ? errs.length > 0
                : errs !== null && errs !== undefined
        );
        if (hasPasswordErrors) {
            setError("Please fix password errors before saving.");
            return;
        }

        const requiredField = schema.fields.find(
            (f) => f.required && !data[f.name]
        );
        if (requiredField) {
            setError(`${requiredField.label} is required.`);
            return;
        }

        setSaving(true);
        try {
            await onSave(type, data);
            onClose();
        } catch {
            setError("Failed to save entry.");
        } finally {
            setSaving(false);
        }
    };

    // Pair fields into rows of 2
    const fieldPairs = schema.fields.reduce((acc, f, i) => {
        const isFullWidth = ["textarea", "list", "kvlist", "url"].includes(
            f.type
        );
        if (isFullWidth) {
            acc.push([f]);
        } else {
            const last = acc[acc.length - 1];
            if (
                last &&
                last.length === 1 &&
                !["textarea", "list", "kvlist", "url"].includes(last[0].type)
            ) {
                last.push(f);
            } else {
                acc.push([f]);
            }
        }
        return acc;
    }, []);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>
                        {existing ? "Edit Entry" : "Add Entry"}
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {/* Category selector — only for new entries */}
                    {!existing && (
                        <div className={styles.typeSelector}>
                            {VAULT_CATEGORY_LIST.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    className={`${styles.typeBtn} ${
                                        type === cat.id
                                            ? styles.typeBtnActive
                                            : ""
                                    }`}
                                    onClick={() => setType(cat.id)}
                                >
                                    {cat.icon} {cat.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={styles.fields}>
                        {fieldPairs.map((pair, i) => (
                            <div
                                key={i}
                                className={
                                    pair.length === 2
                                        ? styles.row
                                        : styles.fullRow
                                }
                            >
                                {pair.map((field) => (
                                    <div
                                        key={field.name}
                                        className={styles.field}
                                    >
                                        <label className={styles.label}>
                                            {field.label}
                                            {field.required && (
                                                <span
                                                    className={styles.required}
                                                >
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <FieldInput
                                            field={field}
                                            value={data[field.name]}
                                            onChange={(val) =>
                                                handleFieldChange(
                                                    field.name,
                                                    val
                                                )
                                            }
                                            onValidationError={
                                                handleValidationError
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
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
                                : "Add Entry"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
