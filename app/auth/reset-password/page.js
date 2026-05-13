"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/common/AuthCard";
import FormField from "@/components/common/FormField";
import styles from "../auth.module.css";
import FormActions from "@/components/common/FormActions";

const validatePassword = (pwd) => {
    if (pwd.length < 8 || pwd.length > 16)
        return "Password must be 8–16 characters.";
    if (!/[a-z]/.test(pwd)) return "Must contain a lowercase letter.";
    if (!/[A-Z]/.test(pwd)) return "Must contain an uppercase letter.";
    if (!/[0-9]/.test(pwd)) return "Must contain a number.";
    if (!/[^a-zA-Z0-9]/.test(pwd)) return "Must contain a special character.";
    return null;
};

export default function ResetPasswordPage() {
    const router = useRouter();
    const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) =>
        setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const pwdError = validatePassword(form.newPassword);
        if (pwdError) return setError(pwdError);
        if (form.newPassword !== form.confirmPassword)
            return setError("Passwords do not match.");

        setLoading(true);
        const res = await window.electronAPI.admin.users.changePassword({
            newPassword: form.newPassword,
        });
        setLoading(false);

        if (res.success) {
            router.replace("/dashboard");
        } else {
            setError(res.message ?? "Something went wrong.");
        }
    };

    return (
        <AuthCard
            title="Set New Password"
            subtitle="Your password was reset by an admin. Please set a new password to continue."
        >
            <form className={styles.form} onSubmit={handleSubmit}>
                <FormField
                    id="newPassword"
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    required
                />
                <FormField
                    id="confirmPassword"
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                />

                {error && <p className={styles.error}>{error}</p>}

                <FormActions
                    submitLabel={loading ? "Saving..." : "Set New Password"}
                    loading={loading}
                    onCancel={() => router.replace("/auth/login")}
                />
            </form>
        </AuthCard>
    );
}
