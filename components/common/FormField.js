import { forwardRef } from "react";
import styles from "./FormField.module.css";

const FormField = forwardRef(function FormField(
    {
        id,
        label,
        type = "text",
        name,
        value,
        onChange,
        required = false,
        readOnly = false,
    },
    ref
) {
    return (
        <div className={styles.formGroup}>
            <label htmlFor={id} className={styles.label}>
                {label}
            </label>
            <input
                ref={ref}
                id={id}
                name={name}
                type={type}
                className={`${styles.input} ${
                    readOnly ? styles.inputReadOnly : ""
                }`}
                value={value}
                onChange={onChange}
                required={required}
                readOnly={readOnly}
            />
        </div>
    );
});

export default FormField;
