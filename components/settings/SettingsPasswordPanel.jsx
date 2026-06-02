"use client";

import { useState } from "react";
import styles from "./settings.module.css";

export default function SettingsPasswordPanel() {
    const [passwords, setPasswords] = useState({
        current: "",
        newPass: "",
        confirm: "",
    });

    const [passError, setPassError] = useState("");
    const [passSuccess, setPassSuccess] = useState("");
    const [savingPass, setSavingPass] = useState(false);

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        setPassError("");
        setPassSuccess("");
        if (!passwords.current)
            return setPassError("Current password is required.");
        if (!passwords.newPass)
            return setPassError("New password is required.");
        if (passwords.newPass.length < 8)
            return setPassError("New password must be at least 8 characters.");
        if (passwords.newPass !== passwords.confirm)
            return setPassError("Passwords do not match.");
        setSavingPass(true);
        try {
            const result = await window.electronAPI.settings.changePassword({
                currentPassword: passwords.current,
                newPassword: passwords.newPass,
            });
            if (!result.success) return setPassError(result.message);
            setPassSuccess("Password changed successfully.");
            setPasswords({ current: "", newPass: "", confirm: "" });
        } catch (err) {
            setPassError(err.message);
        } finally {
            setSavingPass(false);
        }
    };

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>🔒</div>
                <div>
                    <h2 className={styles.cardTitle}>Change Password</h2>
                    <p className={styles.cardSubtitle}>
                        Keep your account secure
                    </p>
                </div>
            </div>

            <form onSubmit={handlePasswordSave} className={styles.form}>
                <div className={styles.field}>
                    <label className={styles.label}>
                        Current Password{" "}
                        <span className={styles.required}>*</span>
                    </label>
                    <input
                        className={styles.input}
                        type="password"
                        value={passwords.current}
                        onChange={(e) =>
                            setPasswords((p) => ({
                                ...p,
                                current: e.target.value,
                            }))
                        }
                        placeholder="••••••••"
                    />
                </div>
                <div className={styles.row}>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            New Password{" "}
                            <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            type="password"
                            value={passwords.newPass}
                            onChange={(e) =>
                                setPasswords((p) => ({
                                    ...p,
                                    newPass: e.target.value,
                                }))
                            }
                            placeholder="••••••••"
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Confirm New Password{" "}
                            <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) =>
                                setPasswords((p) => ({
                                    ...p,
                                    confirm: e.target.value,
                                }))
                            }
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {passError && <p className={styles.error}>{passError}</p>}
                {passSuccess && <p className={styles.success}>{passSuccess}</p>}

                <div className={styles.actions}>
                    <button
                        type="submit"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        disabled={savingPass}
                    >
                        {savingPass ? "Changing..." : "Change Password"}
                    </button>
                </div>
            </form>
        </div>
    );
}
