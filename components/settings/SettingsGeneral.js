"use client";

import { useState, useEffect } from "react";
import styles from "./settings.module.css";

export default function SettingsGeneral() {
    const [profile, setProfile] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
    });
    const [passwords, setPasswords] = useState({
        current: "",
        newPass: "",
        confirm: "",
    });

    const [profileError, setProfileError] = useState("");
    const [profileSuccess, setProfileSuccess] = useState("");
    const [passError, setPassError] = useState("");
    const [passSuccess, setPassSuccess] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPass, setSavingPass] = useState(false);

    useEffect(() => {
        async function load() {
            const session = await window.electronAPI.getSession();
            const user = await window.electronAPI.settings.getProfile(
                session.userId
            );
            setProfile({
                firstName: user.first_name || "",
                lastName: user.last_name || "",
                email: user.email || "",
                phone: user.phone || "",
            });
        }
        load();
    }, []);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileError("");
        setProfileSuccess("");
        if (!profile.firstName.trim())
            return setProfileError("First name is required.");
        if (!profile.email.trim()) return setProfileError("Email is required.");
        setSavingProfile(true);
        try {
            await window.electronAPI.settings.updateProfile({
                firstName: profile.firstName.trim(),
                lastName: profile.lastName.trim(),
                email: profile.email.trim(),
                phone: profile.phone.trim(),
            });
            setProfileSuccess("Profile updated successfully.");
        } catch (err) {
            setProfileError(err.message);
        } finally {
            setSavingProfile(false);
        }
    };

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
        <div className={styles.settingsPage}>
            {/* ── Profile Card ── */}
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>👤</div>
                    <div>
                        <h2 className={styles.cardTitle}>Profile</h2>
                        <p className={styles.cardSubtitle}>
                            Update your personal information
                        </p>
                    </div>
                </div>

                <form onSubmit={handleProfileSave} className={styles.form}>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                First Name{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                value={profile.firstName}
                                onChange={(e) =>
                                    setProfile((p) => ({
                                        ...p,
                                        firstName: e.target.value,
                                    }))
                                }
                                placeholder="John"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Last Name</label>
                            <input
                                className={styles.input}
                                value={profile.lastName}
                                onChange={(e) =>
                                    setProfile((p) => ({
                                        ...p,
                                        lastName: e.target.value,
                                    }))
                                }
                                placeholder="Doe"
                            />
                        </div>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Email <span className={styles.required}>*</span>
                        </label>
                        <input
                            className={styles.input}
                            type="email"
                            value={profile.email}
                            onChange={(e) =>
                                setProfile((p) => ({
                                    ...p,
                                    email: e.target.value,
                                }))
                            }
                            placeholder="john@example.com"
                        />
                    </div>
                    <div className={styles.row}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Mobile Number
                            </label>
                            <input
                                className={styles.input}
                                type="tel"
                                value={profile.phone}
                                onChange={(e) =>
                                    setProfile((p) => ({
                                        ...p,
                                        phone: e.target.value,
                                    }))
                                }
                                placeholder="+44 7700 900000"
                            />
                        </div>
                        <div style={{ flex: 1 }} /> {/* spacer */}
                    </div>
                    {profileError && (
                        <p className={styles.error}>{profileError}</p>
                    )}
                    {profileSuccess && (
                        <p className={styles.success}>{profileSuccess}</p>
                    )}

                    <div className={styles.actions}>
                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            disabled={savingProfile}
                        >
                            {savingProfile ? "Saving..." : "Update Profile"}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Change Password Card ── */}
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
                    {passSuccess && (
                        <p className={styles.success}>{passSuccess}</p>
                    )}

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
        </div>
    );
}
