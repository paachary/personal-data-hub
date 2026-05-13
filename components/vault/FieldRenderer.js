"use client";

import { useState, useEffect, useMemo } from "react";
import {
    validatePassword,
    getPasswordStrength,
} from "@/constants/passwordRules";
import styles from "./FieldRenderer.module.css";

// ── Separate component so hooks are always called unconditionally ──
function PasswordInput({ field, value, onChange, onValidationError }) {
    const [show, setShow] = useState(false);

    const errors = useMemo(
        () =>
            field.type === "password" && value // ← only validate if value is non-empty
                ? validatePassword(value)
                : [],
        [field.type, value]
    );
    const strength =
        field.type === "password" ? getPasswordStrength(value) : null;
    const errorsKey = errors ? errors.join("|") : "";

    useEffect(() => {
        if (onValidationError) {
            onValidationError(field.name, errors);
        }
    }, [errorsKey, field.name, onValidationError, errors]);

    return (
        <div className={styles.passwordBlock}>
            <div className={styles.passwordWrapper}>
                <input
                    className={`${styles.input} ${
                        errors && value ? styles.inputError : ""
                    }`}
                    type={show ? "text" : "password"}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="••••••••"
                    maxLength={20}
                />
                <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShow((s) => !s)}
                >
                    {show ? "🙈" : "👁️"}
                </button>
            </div>

            {value && strength && (
                <div className={styles.strengthRow}>
                    <div className={styles.strengthBar}>
                        <div
                            className={styles.strengthFill}
                            style={{
                                width:
                                    strength.label === "Weak"
                                        ? "33%"
                                        : strength.label === "Medium"
                                        ? "66%"
                                        : "100%",
                                background: strength.color,
                            }}
                        />
                    </div>
                    <span
                        className={styles.strengthLabel}
                        style={{ color: strength.color }}
                    >
                        {strength.label}
                    </span>
                </div>
            )}

            {errors && value && (
                <ul className={styles.ruleList}>
                    {errors.map((err) => (
                        <li key={err} className={styles.ruleItem}>
                            ✗ {err}
                        </li>
                    ))}
                </ul>
            )}

            {!errors && value && (
                <p className={styles.ruleOk}>
                    ✓ Password meets all requirements
                </p>
            )}
            {!value && (
                <p className={styles.ruleHint}>
                    8–20 chars · uppercase · lowercase · number · special
                    character
                </p>
            )}
        </div>
    );
}

// ── Main FieldInput ───────────────────────────────────────
export function FieldInput({ field, value, onChange, onValidationError }) {
    const [show, setShow] = useState(false);

    const handleListAdd = () => onChange([...(value || []), ""]);
    const handleListChange = (i, val) => {
        const u = [...(value || [])];
        u[i] = val;
        onChange(u);
    };
    const handleListRemove = (i) =>
        onChange((value || []).filter((_, idx) => idx !== i));
    const handleKVAdd = () =>
        onChange([...(value || []), { key: "", value: "" }]);
    const handleKVChange = (i, k, val) => {
        const u = [...(value || [])];
        u[i] = { ...u[i], [k]: val };
        onChange(u);
    };
    const handleKVRemove = (i) =>
        onChange((value || []).filter((_, idx) => idx !== i));

    if (field.type === "textarea") {
        return (
            <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder || ""}
                rows={3}
            />
        );
    }

    if (field.type === "list") {
        return (
            <div className={styles.listWrapper}>
                {(value || []).map((item, i) => (
                    <div key={i} className={styles.listRow}>
                        <input
                            className={styles.input}
                            value={item}
                            onChange={(e) =>
                                handleListChange(i, e.target.value)
                            }
                            placeholder={`ID ${i + 1}`}
                        />
                        <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => handleListRemove(i)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className={styles.addRowBtn}
                    onClick={handleListAdd}
                >
                    + Add ID
                </button>
            </div>
        );
    }

    if (field.type === "kvlist") {
        return (
            <div className={styles.listWrapper}>
                {(value || []).map((pair, i) => (
                    <div key={i} className={styles.kvRow}>
                        <input
                            className={styles.input}
                            value={pair.key}
                            onChange={(e) =>
                                handleKVChange(i, "key", e.target.value)
                            }
                            placeholder="Key"
                        />
                        <input
                            className={styles.input}
                            value={pair.value}
                            onChange={(e) =>
                                handleKVChange(i, "value", e.target.value)
                            }
                            placeholder="Value"
                        />
                        <button
                            type="button"
                            className={styles.removeBtn}
                            onClick={() => handleKVRemove(i)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className={styles.addRowBtn}
                    onClick={handleKVAdd}
                >
                    + Add Field
                </button>
            </div>
        );
    }

    // ✅ Delegate to PasswordInput component — hooks called unconditionally inside it
    if (field.type === "password" || field.masked) {
        return (
            <PasswordInput
                field={field}
                value={value}
                onChange={onChange}
                onValidationError={onValidationError}
            />
        );
    }

    return (
        <input
            className={styles.input}
            type={field.type || "text"}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ""}
            required={field.required}
        />
    );
}
