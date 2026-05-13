"use client";

import { useState } from "react";
import styles from "./EntryCard.module.css";
import { VAULT_SCHEMAS } from "@/constants/vaultSchemas";

function MaskedValue({ value }) {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (!value) return <span className={styles.empty}>—</span>;

    return (
        <span className={styles.maskedRow}>
            <span className={styles.maskedValue}>
                {show ? value : "••••••••"}
            </span>
            <button
                className={styles.iconBtn}
                onClick={() => setShow((s) => !s)}
            >
                {show ? "🙈" : "👁️"}
            </button>
            <button className={styles.iconBtn} onClick={copy}>
                {copied ? "✅" : "📋"}
            </button>
        </span>
    );
}

function CopyValue({ value }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (!value) return <span className={styles.empty}>—</span>;

    return (
        <span className={styles.maskedRow}>
            <span className={styles.fieldValue}>{value}</span>
            <button className={styles.iconBtn} onClick={copy}>
                {copied ? "✅" : "📋"}
            </button>
        </span>
    );
}

export default function EntryCard({ entry, onEdit, onDelete }) {
    const schema = VAULT_SCHEMAS[entry.type];
    if (!schema) return null;

    const displayValue = entry.data[schema.displayField] || "Untitled";

    return (
        <div className={styles.card}>
            <div className={styles.cardTop}>
                <div className={styles.cardMeta}>
                    <span className={styles.icon}>{schema.icon}</span>
                    <div>
                        <p className={styles.label}>{displayValue}</p>
                        <span className={styles.badge}>{schema.label}</span>
                    </div>
                </div>
                <div className={styles.cardActions}>
                    <button
                        className={styles.actionBtn}
                        onClick={() => onEdit(entry)}
                        title="Edit"
                    >
                        ✏️
                    </button>
                    <button
                        className={styles.actionBtn}
                        onClick={() => onDelete(entry.id)}
                        title="Delete"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <div className={styles.fieldList}>
                {schema.fields.map((field) => {
                    const value = entry.data[field.name];
                    const isEmpty =
                        !value || (Array.isArray(value) && value.length === 0);

                    if (isEmpty) return null;

                    if (field.type === "list") {
                        return (
                            <div key={field.name} className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>
                                    {field.label}
                                </span>
                                <span className={styles.fieldValue}>
                                    {value.join(", ")}
                                </span>
                            </div>
                        );
                    }

                    if (field.type === "kvlist") {
                        return value.map((pair, i) => (
                            <div key={i} className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>
                                    {pair.key}
                                </span>
                                <span className={styles.fieldValue}>
                                    {pair.value}
                                </span>
                            </div>
                        ));
                    }

                    if (field.type === "textarea") {
                        return (
                            <div key={field.name} className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>
                                    {field.label}
                                </span>
                                <span className={styles.fieldNote}>
                                    {value}
                                </span>
                            </div>
                        );
                    }

                    if (field.masked || field.type === "password") {
                        return (
                            <div key={field.name} className={styles.fieldRow}>
                                <span className={styles.fieldLabel}>
                                    {field.label}
                                </span>
                                <MaskedValue value={value} />
                            </div>
                        );
                    }

                    return (
                        <div key={field.name} className={styles.fieldRow}>
                            <span className={styles.fieldLabel}>
                                {field.label}
                            </span>
                            <CopyValue value={value} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
