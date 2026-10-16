"use client";

import { useState } from "react";
import styles from "./finance.module.css";

const BANK_OPTIONS = [
    { code: "HDFC", label: "HDFC Bank" },
    { code: "ICICI", label: "ICICI Bank" },
    { code: "SBI", label: "State Bank of India (SBI)" },
    { code: "UNION", label: "Union Bank of India" },
    { code: "STANCHART", label: "Standard Chartered Bank" },
];

const FORMAT_OPTIONS = [
    { code: "csv", label: "CSV File" },
    { code: "xlsx", label: "Excel File" },
];

export default function StatementImportModal({
    accounts = [],
    userId,
    onClose,
    onSuccess,
    onViewTransactions,
}) {
    const [selectedBank, setSelectedBank] = useState("");
    const [selectedAccount, setSelectedAccount] = useState("");
    const [selectedFormat, setSelectedFormat] = useState("");
    const [filePath, setFilePath] = useState("");
    const [fileName, setFileName] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [result, setResult] = useState(null);

    // Filter accounts by selected bank if needed (optional enhancement)
    const filteredAccounts = accounts.filter(
        (acc) =>
            !selectedBank || !acc.bank_code || acc.bank_code === selectedBank,
    );

    const handleSelectFile = async () => {
        setError("");
        setLoading(true);

        try {
            const response =
                await window.electronAPI.finance.selectStatementFile({
                    bankCode: selectedBank,
                    format: selectedFormat,
                });

            if (response.success) {
                setFilePath(response.filePath);
                setFileName(response.fileName);
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setResult(null);

        if (!selectedBank) {
            setError("Please select a bank.");
            return;
        }

        if (!selectedAccount) {
            setError("Please select an account.");
            return;
        }

        if (!filePath) {
            setError("Please select a file.");
            return;
        }

        setUploading(true);

        try {
            const accountId = parseInt(selectedAccount, 10);
            const response = await window.electronAPI.finance.importStatements({
                accountId,
                bankCode: selectedBank,
                filePath,
                format: selectedFormat,
            });

            if (response.success) {
                setSuccess(
                    `✓ Successfully imported ${response.imported} transactions!`,
                );
                setResult({
                    statementId: response.statementId,
                    accountId,
                    imported: response.imported,
                    skipped: response.skipped,
                    duplicates: response.duplicates,
                    errors: response.errors,
                    parsingErrors: response.parsingErrors,
                });
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    if (result) {
        return (
            <div className={styles.overlay} onClick={onClose}>
                <div
                    className={styles.modal}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.modalHeader}>
                        <h2 className={styles.modalTitle}>Import Summary</h2>
                        <button className={styles.closeBtn} onClick={onClose}>
                            ✕
                        </button>
                    </div>

                    <div className={styles.fields}>
                        <div className={styles.successMessage}>
                            <p>✓ Import completed successfully!</p>
                        </div>

                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryItem}>
                                <p className={styles.summaryLabel}>Imported</p>
                                <p className={styles.summaryValue}>
                                    {result.imported}
                                </p>
                            </div>
                            <div className={styles.summaryItem}>
                                <p className={styles.summaryLabel}>
                                    Skipped (Duplicates)
                                </p>
                                <p className={styles.summaryValue}>
                                    {result.duplicates}
                                </p>
                            </div>
                            <div className={styles.summaryItem}>
                                <p className={styles.summaryLabel}>Errors</p>
                                <p className={styles.summaryValue}>
                                    {result.errors}
                                </p>
                            </div>
                        </div>

                        {result.parsingErrors &&
                            result.parsingErrors.length > 0 && (
                                <div className={styles.errorList}>
                                    <p className={styles.label}>
                                        Parsing Errors (first 10):
                                    </p>
                                    {result.parsingErrors.map((err, idx) => (
                                        <p
                                            key={idx}
                                            className={styles.errorItem}
                                        >
                                            Line {err.lineNum}:{" "}
                                            {err.errors.join(", ")}
                                        </p>
                                    ))}
                                </div>
                            )}

                        <div className={styles.actions}>
                            {result.imported > 0 && onViewTransactions && (
                                <button
                                    type="button"
                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                    onClick={() =>
                                        onViewTransactions(
                                            result.statementId,
                                            result.accountId,
                                        )
                                    }
                                >
                                    👁️ View Transactions
                                </button>
                            )}
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={onClose}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>Import Bank Statement</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleUpload} className={styles.fields}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Bank <span className={styles.required}>*</span>
                        </label>
                        <select
                            className={styles.select}
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                        >
                            <option value="">— Select Bank —</option>
                            {BANK_OPTIONS.map((b) => (
                                <option key={b.code} value={b.code}>
                                    {b.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Account{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <select
                                className={styles.select}
                                value={selectedAccount}
                                onChange={(e) =>
                                    setSelectedAccount(e.target.value)
                                }
                            >
                                <option value="">— Select Account —</option>
                                {filteredAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.bank_name} — {a.account_number}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>
                                Format{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <select
                                className={styles.select}
                                value={selectedFormat}
                                onChange={(e) =>
                                    setSelectedFormat(e.target.value)
                                }
                            >
                                <option value="">— Select Format —</option>
                                {FORMAT_OPTIONS.map((f) => (
                                    <option key={f.code} value={f.code}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>
                            Statement File{" "}
                            <span className={styles.required}>*</span>
                        </label>
                        <div className={styles.filePickerRow}>
                            <input
                                className={styles.input}
                                value={fileName}
                                readOnly
                                placeholder="Select a file..."
                            />
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={handleSelectFile}
                                disabled={loading || !selectedBank}
                            >
                                {loading ? "Loading..." : "Browse"}
                            </button>
                        </div>
                    </div>

                    {error && <p className={styles.error}>{error}</p>}
                    {success && <p className={styles.success}>{success}</p>}

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
                            disabled={
                                uploading ||
                                !selectedBank ||
                                !selectedAccount ||
                                !filePath
                            }
                        >
                            {uploading ? "Importing..." : "Import Statement"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
