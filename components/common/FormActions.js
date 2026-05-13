import styles from "./FormActions.module.css";

export default function FormActions({
    onCancel,
    onReset,
    submitLabel = "Submit",
    resetLabel = "Reset",
    loading = false,
}) {
    return (
        <div className={styles.actions}>
            <button
                type="button"
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onCancel}
                disabled={loading}
            >
                Cancel
            </button>
            {onReset && (
                <button
                    type="button"
                    className={`${styles.button} ${styles.buttonReset}`}
                    onClick={onReset}
                    disabled={loading}
                >
                    {resetLabel}
                </button>
            )}
            <button
                type="submit"
                className={`${styles.button} ${styles.buttonPrimary} ${
                    loading ? styles.buttonLoading : ""
                }`}
                disabled={loading}
            >
                {loading ? (
                    <>
                        <span className={styles.spinner} />
                        {submitLabel === "Register"
                            ? "Registering..."
                            : "Submitting..."}
                    </>
                ) : (
                    submitLabel
                )}
            </button>
        </div>
    );
}
