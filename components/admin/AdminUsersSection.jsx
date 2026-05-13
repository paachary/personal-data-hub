"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "@/components/finance/finance.module.css";
import modalStyles from "@/components/finance/finance.module.css";

export default function AdminUsersSection() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null); // user for reset
    const [tempPassword, setTempPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const data = await window.electronAPI.admin.users.getAll();
        setUsers(data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const data = await window.electronAPI.admin.users.getAll();
            if (!cancelled) {
                setUsers(data ?? []);
                setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openReset = (user) => {
        setSelected(user);
        setTempPassword("");
        setConfirm("");
        setError("");
        setSuccess("");
        setShowModal(true);
    };

    const handleMfaReset = async (user) => {
        if (
            !confirm(
                `Reset MFA for @${user.username}? They will need to set it up again on next login.`
            )
        )
            return;
        const res = await window.electronAPI.auth.mfa.reset({
            userId: user.id,
        });
        if (res.success) {
            setSuccess(`✅ MFA reset for @${user.username}.`);
            setTimeout(() => setSuccess(""), 5000);
            load();
        }
    };

    const handleReset = async () => {
        setError("");
        if (tempPassword.length < 8 || tempPassword.length > 14)
            return setError("Password must be 8–14 characters.");
        if (!/[a-z]/.test(tempPassword))
            return setError("Must contain a lowercase letter.");
        if (!/[A-Z]/.test(tempPassword))
            return setError("Must contain an uppercase letter.");
        if (!/[0-9]/.test(tempPassword))
            return setError("Must contain a number.");
        if (!/[^a-zA-Z0-9]/.test(tempPassword))
            return setError("Must contain a special character.");
        if (tempPassword !== confirm)
            return setError("Passwords do not match.");

        const res = await window.electronAPI.admin.users.resetPassword({
            userId: selected.id,
            tempPassword,
        });

        if (res.success) {
            setShowModal(false); // ← close modal immediately
            setSelected(null);
            setSuccess(
                `✅ Password reset for @${selected.username}. They will be prompted to change it on next login.`
            );
            setTimeout(() => setSuccess(""), 5000); // ← auto dismiss after 5s
            load();
        } else {
            setError(res.message ?? "Something went wrong.");
        }
    };

    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>User Management</h2>
                    <p className={styles.subtitle}>
                        View all registered users and manage their accounts
                    </p>
                </div>
            </div>

            {/* ← success banner on main section */}
            {success && <p className={styles.success}>{success}</p>}

            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>City</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        {u.first_name} {u.last_name}
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            @{u.username}
                                        </span>
                                    </td>
                                    <td>{u.email}</td>
                                    <td>
                                        {u.city}, {u.state}
                                    </td>
                                    <td>
                                        <span className={styles.cardBadge}>
                                            {u.is_admin ? "Admin" : "User"}
                                        </span>
                                    </td>
                                    <td>
                                        {u.requires_password_reset ? (
                                            <span
                                                className={styles.closedBadge}
                                            >
                                                Reset Pending
                                            </span>
                                        ) : (
                                            <span
                                                className={styles.activeBadge}
                                            >
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                onClick={() => openReset(u)}
                                            >
                                                🔑 Reset Password
                                            </button>
                                            <button
                                                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                onClick={() =>
                                                    handleMfaReset(u)
                                                }
                                            >
                                                🔐 Reset MFA
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {showModal && selected && (
                <div className={modalStyles.overlay}>
                    <div className={modalStyles.modal}>
                        <div className={modalStyles.modalHeader}>
                            <h2 className={modalStyles.modalTitle}>
                                Reset Password — @{selected.username}
                            </h2>
                            <button
                                className={modalStyles.closeBtn}
                                onClick={() => setShowModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <p
                            style={{
                                color: "#fff",
                                fontSize: "0.85rem",
                                margin: "0 0 1rem",
                            }}
                        >
                            The user will be prompted to change this temporary
                            password on next login.
                        </p>

                        <div className={modalStyles.field}>
                            <label className={modalStyles.label}>
                                Temporary Password
                            </label>
                            <input
                                className={modalStyles.input}
                                type="password"
                                value={tempPassword}
                                onChange={(e) =>
                                    setTempPassword(e.target.value)
                                }
                                placeholder="Min 8, max 16 characters"
                            />
                        </div>

                        <div className={modalStyles.field}>
                            <label className={modalStyles.label}>
                                Confirm Password
                            </label>
                            <input
                                className={modalStyles.input}
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                            />
                        </div>

                        {error && <p className={modalStyles.error}>{error}</p>}
                        {success && (
                            <p className={modalStyles.success}>{success}</p>
                        )}

                        <div className={modalStyles.actions}>
                            <button
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => setShowModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={handleReset}
                            >
                                Reset Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
