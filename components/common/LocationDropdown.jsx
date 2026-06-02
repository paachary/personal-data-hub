import styles from "./FormField.module.css";

export default function LocationDropdown({
    id,
    label,
    name,
    value,
    onChange,
    options = [],
    disabled = false,
    required = false,
    placeholder = "— Select —",
    loading = false,
}) {
    return (
        <div className={styles.formGroup}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            <select
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                disabled={disabled || loading}
                required={required}
                className={`${styles.select} ${disabled || loading ? styles.selectDisabled : ""}`}
            >
                <option value="">{loading ? "Loading…" : placeholder}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        </div>
    );
}
