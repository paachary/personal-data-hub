// app/auth/register/RegisterForm.js
"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../auth.module.css";
import FormField from "@/components/common/FormField";
import FormActions from "@/components/common/FormActions";
import { validatePassword } from "@/constants/passwordRules";
import useFormState from "@/hooks/useFormState";

function RegisterFormInner() {
    const router = useRouter();
    const firstNameRef = useRef(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const [loading, setLoading] = useState(false);

    const {
        form,
        setForm,
        error,
        success,
        setError,
        setSuccess,
        handleChange,
        resetForm,
    } = useFormState({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        phone: "", // ← Add
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        password: "",
        confirmPassword: "",
    });

    // Focus first name on mount
    useEffect(() => {
        firstNameRef.current?.focus();
    }, []);

    const ADMIN_DEFAULTS = {
        firstName: "System",
        lastName: "Administrator",
        username: "sysadmin",
    };

    const EMPTY_FORM = {
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        password: "",
        confirmPassword: "",
    };

    const handleAdminToggle = (checked) => {
        setIsAdmin(checked);
        if (checked) {
            setForm((prev) => ({
                ...prev,
                firstName: ADMIN_DEFAULTS.firstName,
                lastName: ADMIN_DEFAULTS.lastName,
                username: ADMIN_DEFAULTS.username,
            }));
        } else {
            setForm(EMPTY_FORM); // reset all fields
        }
    };

    const handleReset = () => {
        setIsAdmin(false);
        resetForm();
        firstNameRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        // ← Fix: validatePassword returns array
        const pwdErrors = validatePassword(form.password);
        if (pwdErrors.length > 0) {
            setError(pwdErrors[0]); // Show first error
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (typeof window === "undefined" || !window.electronAPI?.register) {
            setError("Electron bridge not available.");
            return;
        }

        setLoading(true);

        try {
            const res = await window.electronAPI.register({
                firstName: form.firstName,
                lastName: form.lastName,
                username: form.username,
                email: form.email,
                phone: form.phone,
                address: {
                    line1: form.addressLine1,
                    line2: form.addressLine2,
                    city: form.city,
                    state: form.state,
                    zip: form.zip,
                    country: form.country,
                },
                password: form.password,
                isAdmin,
            });

            if (res.success) {
                localStorage.setItem("justRegistered", "true");
                router.replace("/auth/login?registered=true");
            } else {
                setError(res.message || "Registration failed.");
            }
        } catch (err) {
            console.error("[Register Error]", err); // ← Improved log
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            {/* ── Role ── */}
            {/* <p className={styles.groupLabel}>Role</p> */}
            <div className={styles.checkboxRow}>
                <input
                    id="isAdmin"
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => handleAdminToggle(e.target.checked)}
                />
                <label htmlFor="isAdmin">Register as Admin</label>
            </div>

            {/* ── Personal Info ── */}
            <p className={styles.groupLabel}>Personal Info</p>
            <div className={styles.row}>
                <FormField
                    id="firstName"
                    label="First Name"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    readOnly={isAdmin}
                    required
                />
                <FormField
                    id="lastName"
                    label="Last Name"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    readOnly={isAdmin}
                    required
                />
            </div>

            {/* ── Address ── */}
            <p className={styles.groupLabel}>Address</p>
            <FormField
                id="addressLine1"
                label="Street Address"
                name="addressLine1"
                value={form.addressLine1}
                onChange={handleChange}
                required
            />
            <FormField
                id="addressLine2"
                label="Apartment / Suite (optional)"
                name="addressLine2"
                value={form.addressLine2}
                onChange={handleChange}
            />
            <div className={styles.row}>
                <FormField
                    id="city"
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                />
                <FormField
                    id="state"
                    label="State"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    required
                />
            </div>
            <div className={styles.row}>
                <FormField
                    id="zip"
                    label="ZIP Code"
                    name="zip"
                    value={form.zip}
                    onChange={handleChange}
                    required
                />
                <FormField
                    id="country"
                    label="Country"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                />
            </div>

            {/* ── Account Credentials ── */}
            <p className={styles.groupLabel}>Account Credentials</p>
            <div className={styles.row}>
                <FormField
                    id="username"
                    label="Username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    readOnly={isAdmin}
                    required
                />
                <FormField
                    id="email"
                    label="Email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                />
                <div className={styles.row}>
                    <FormField
                        id="phone"
                        label="Mobile Number"
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+44 7700 900000"
                    />
                    <div style={{ flex: 1 }} /> {/* spacer */}
                </div>
            </div>

            <div className={styles.row}>
                <FormField
                    id="password"
                    label="Password"
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                />
                <FormField
                    id="confirmPassword"
                    label="Confirm Password"
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                />
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {success && <p className={styles.success}>{success}</p>}

            <FormActions
                onCancel={resetForm}
                onReset={handleReset}
                submitLabel="Register"
                loading={loading}
            />
        </form>
    );
}

export default function RegisterForm() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RegisterFormInner />
        </Suspense>
    );
}
