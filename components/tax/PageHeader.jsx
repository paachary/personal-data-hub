"use client";

import styles from "./taxPage.module.css";

const EMPTY = "—";

export default function PageHeader({ summary, canSave, dirty, saving, exporting, notice, onSave, onExport }) {
    const recommended = summary ? summary.recommendedLabel : EMPTY;
    const saves = summary?.savingText ? ` · Saves ${summary.savingText}` : "";

    return (
        <header className={styles.headerRow}>
            <div className={styles.chips}>
                <div className={`${styles.chip} ${styles.chipAccent}`}>
                    <span className={styles.chipLabel}>Recommended</span>
                    <span className={styles.chipValue}>{`${recommended}${saves}`}</span>
                </div>
                <div className={styles.chip}>
                    <span className={styles.chipLabel}>Total tax</span>
                    <span className={styles.chipValue}>{summary ? summary.totalTaxText : EMPTY}</span>
                </div>
                <div className={styles.chip}>
                    <span className={styles.chipLabel}>Net payable</span>
                    <span className={styles.chipValue}>{summary ? summary.payableText : EMPTY}</span>
                </div>
            </div>

            <div className={styles.actions}>
                {notice && <span className={notice.kind === "error" ? styles.statusError : styles.status} role="status">{notice.text}</span>}
                {dirty && !notice && <span className={styles.status}>Unsaved changes</span>}
                <button
                    type="button"
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    disabled={!canSave || saving}
                    onClick={onSave}
                >
                    {saving ? "Saving…" : "Save profile"}
                </button>
                <button type="button" className={styles.button} disabled={dirty || exporting} onClick={() => onExport("excel")}>
                    Export Excel
                </button>
                <button type="button" className={styles.button} disabled={dirty || exporting} onClick={() => onExport("word")}>
                    Export Word
                </button>
            </div>
        </header>
    );
}
