"use client";

import { useRef, useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../auth.module.css";
import FormField from "@/components/common/FormField";
import FormActions from "@/components/common/FormActions";
import useFormState from "@/hooks/useFormState";

function LoginFormInner() {
    const router = useRouter();
    const [justRegistered, setJustRegistered] = useState(false); // ← Initialize as false
    const [timedOut, setTimedOut] = useState(false); // ← localStorage instead of searchParams

    const searchParams = useSearchParams();

    // URL-based alerts

    useEffect(() => {
        if (localStorage.getItem("justRegistered") === "true") {
            setJustRegistered(true);
            localStorage.removeItem("justRegistered");
        }

        if (localStorage.getItem("sessionTimedOut") === "true") {
            setTimedOut(true);
            localStorage.removeItem("sessionTimedOut");
        }
        usernameRef.current?.focus();
    }, []);
    const usernameRef = useRef(null);
    const { form, error, setError, handleChange, resetForm } = useFormState({
        username: "",
        password: "",
    });

    useEffect(() => {
        usernameRef.current?.focus();
    }, []);

    const handleReset = () => {
        resetForm();
        usernameRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (typeof window === "undefined" || !window.electronAPI?.login) {
            setError("Electron bridge not available.");
            return;
        }

        try {
            const res = await window.electronAPI.login({
                username: form.username,
                password: form.password,
            });

            if (res.success) {
                if (res.requiresPasswordReset)
                    router.replace("/auth/reset-password");
                else if (res.mfaSetupRequired)
                    router.replace("/auth/setup-mfa");
                else if (res.requiresMfa) router.replace("/auth/verify-mfa");
                else router.replace("/dashboard");
            } else {
                setError(res.message);
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred.");
        }
    };

    return (
        <div>
            {justRegistered && (
                <div className={styles.successBanner}>
                    🎉 Account created successfully! Please log in.
                </div>
            )}

            {timedOut && (
                <div className={styles.warningBanner}>
                    🔒 You were logged out due to inactivity.
                </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
                <FormField
                    ref={usernameRef}
                    id="username"
                    label="Username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    required
                />
                <FormField
                    id="password"
                    label="Password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                />

                {error && <p className={styles.error}>{error}</p>}

                <FormActions
                    onCancel={resetForm}
                    onReset={handleReset}
                    submitLabel="Login"
                />
            </form>
        </div>
    );
}

// Wrap in Suspense because useSearchParams() requires it during static rendering
export default function LoginForm() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <LoginFormInner />
        </Suspense>
    );
}
