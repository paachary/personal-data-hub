import { useState } from "react";

export default function useFormState(initialValues) {
    const [form, setForm] = useState(initialValues);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setForm(initialValues);
        setError("");
        setSuccess("");
    };

    return {
        form,
        setForm,
        error,
        success,
        setError,
        setSuccess,
        handleChange,
        resetForm,
    };
}
