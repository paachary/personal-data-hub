"use client";

import { useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import { errorMessage, formatAmount, formatDate } from "./format";

const CATEGORY_SHORT = {
    stcg111A: "STCG 111A",
    ltcg112A: "LTCG 112A",
    ltcgOther: "LTCG 112",
    stcgOther: "STCG other",
};

const STATUS_LABEL = {
    ok: "Ready",
    warning: "Check",
    duplicate: "Duplicate",
    error: "Error",
};

// Props: kind is "cams" (capital gains) or "income". Calls onImported with a message after a successful commit.
export default function ImportDialog({ kind, fy, onClose, onImported }) {
    const isCams = kind === "cams";
    const [source, setSource] = useState("template");
    const [preview, setPreview] = useState(null);
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const previewKind = isCams ? "cams" : source === "ais" ? "ais" : "incomeTemplate";
    const commitKind = isCams ? "cams" : "incomeTemplate";

    const changeSource = (value) => {
        setSource(value);
        setPreview(null);
        setChosen([]);
        setError("");
    };

    const chooseFile = async () => {
        setBusy(true);
        setError("");
        try {
            const result = await window.electronAPI.tax.import.preview(previewKind, fy);
            if (result.canceled) return;
            setPreview({ fileName: result.fileName, rows: result.rows, notes: result.notes });
            setChosen(result.rows.map((row) => row.selected));
        } catch (err) {
            setPreview(null);
            setChosen([]);
            setError(errorMessage(err, "Could not read the file."));
        } finally {
            setBusy(false);
        }
    };

    const saveTemplate = async () => {
        setError("");
        try {
            await window.electronAPI.tax.import.saveTemplate();
        } catch (err) {
            setError(errorMessage(err, "Could not save the template."));
        }
    };

    const toggle = (index) => setChosen((prev) => prev.map((value, i) => (i === index ? !value : value)));

    const rows = preview ? preview.rows : [];
    const selectedRows = rows.filter((row, i) => chosen[i] && row.status !== "error");
    const errorCount = rows.filter((row) => row.status === "error").length;
    const total = selectedRows.reduce((sum, row) => sum + Number(isCams ? row.gain : row.amount), 0);

    const commit = async () => {
        setBusy(true);
        setError("");
        try {
            const result = await window.electronAPI.tax.import.commit({
                kind: commitKind,
                fy,
                rows: selectedRows,
            });
            const skippedText = result.skipped ? `, skipped ${result.skipped} already stored` : "";
            onImported(`Imported ${result.inserted} row(s)${skippedText}.`);
        } catch (err) {
            setError(errorMessage(err, "Import failed."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="import-dialog-title">
            <div className={styles.modal} style={{ maxWidth: 900 }}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle} id="import-dialog-title">
                        {isCams ? "Import capital gains" : "Import income"} (FY {fy})
                    </h2>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
                </div>

                {error && <div className={taxStyles.error}>{error}</div>}

                {isCams ? (
                    <p className={taxStyles.assumptions}>
                        Upload a CAMS or KFintech capital-gains statement (.xlsx, .xls or .csv). Nothing is saved until you confirm.
                    </p>
                ) : (
                    <div className={styles.fields}>
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="import-source">Source</label>
                            <select
                                id="import-source"
                                className={styles.select}
                                value={source}
                                onChange={(e) => changeSource(e.target.value)}
                                disabled={busy}
                            >
                                <option value="template">Income template (.csv, .xlsx or .xls)</option>
                                <option value="ais">Annual Information Statement (AIS)</option>
                            </select>
                        </div>
                        {source === "template" && (
                            <div>
                                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={saveTemplate} disabled={busy}>
                                    Download template
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={chooseFile} disabled={busy}>
                        {preview ? "Choose another file" : "Choose file"}
                    </button>
                    {preview && <span>{preview.fileName}</span>}
                </div>

                {preview?.notes?.map((note) => (
                    <div key={note} className={`${taxStyles.banner} ${taxStyles.info}`}>{note}</div>
                ))}

                {preview && (
                    <>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Use</th>
                                        <th>{isCams ? "Sale date" : "Row"}</th>
                                        <th>{isCams ? "Scheme" : "Label"}</th>
                                        <th>{isCams ? "Category" : "Type"}</th>
                                        <th className={styles.numeric}>{isCams ? "Gain" : "Amount"}</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr><td colSpan={6}>No rows found in this file.</td></tr>
                                    )}
                                    {rows.map((row, i) => (
                                        <tr key={i}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(chosen[i])}
                                                    disabled={busy || row.status === "error"}
                                                    onChange={() => toggle(i)}
                                                    aria-label={`Select row ${i + 1}`}
                                                />
                                            </td>
                                            <td>{isCams ? formatDate(row.sale_date) : `Line ${row.line ?? i + 1}`}</td>
                                            <td>{isCams ? (row.description || row.scheme || "—") : row.label}</td>
                                            <td>{isCams ? (CATEGORY_SHORT[row.category] || row.category) : row.type}</td>
                                            <td className={styles.numeric}>
                                                {formatAmount(Number(isCams ? row.gain : row.amount))}
                                            </td>
                                            <td>
                                                <div>{STATUS_LABEL[row.status] || row.status}</div>
                                                {[...(row.errors || []), ...(row.warnings || [])].map((msg) => (
                                                    <div key={msg} style={{ fontSize: "0.8rem" }}>{msg}</div>
                                                ))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className={taxStyles.assumptions}>
                            {selectedRows.length} of {rows.length} row(s) selected
                            {errorCount > 0 && ` · ${errorCount} with errors (not importable)`}
                            {selectedRows.length > 0 && ` · ${isCams ? "Total gain" : "Total amount"}: ${formatAmount(total)}`}
                        </div>
                    </>
                )}

                <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={commit}
                        disabled={busy || selectedRows.length === 0}
                    >
                        Import {selectedRows.length} row(s)
                    </button>
                </div>
            </div>
        </div>
    );
}
