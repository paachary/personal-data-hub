"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./finance.module.css";
import BankModal from "./BankModal";
import AccountModal from "./AccountModal";
import UserFilter from "./UserFilter";

export default function BanksSection({ userId, isAdmin, viewAll = false }) {
    const [banks, setBanks] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [tab, setTab] = useState("accounts");
    const [bankModal, setBankModal] = useState(null);
    const [accountModal, setAccountModal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedUsers, setSelectedUsers] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (viewAll) {
                const data = await window.electronAPI.banks.getAllUsers();
                setAccounts(data ?? []);
            } else {
                const [accountData, bankData] = await Promise.all([
                    window.electronAPI.accounts.getByUser(userId),
                    window.electronAPI.banks.getAll(),
                ]);
                setAccounts(accountData ?? []);
                setBanks(bankData ?? []);
            }
        } finally {
            setLoading(false);
        }
    }, [userId, viewAll]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredAccounts = useMemo(() => {
        if (selectedUsers.length === 0) return accounts;
        return accounts.filter((a) => selectedUsers.includes(a.username));
    }, [accounts, selectedUsers]);

    const deleteBank = async (id) => {
        if (!confirm("Delete this bank? This may affect linked accounts."))
            return;
        await window.electronAPI.banks.delete(id);
        load();
    };

    const deleteAccount = async (id) => {
        if (!confirm("Delete this account?")) return;
        await window.electronAPI.accounts.delete(id);
        load();
    };

    // ── Admin "view all" mode ─────────────────────────────────────
    if (viewAll) {
        return (
            <section className={styles.section}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>All Users — Accounts</h2>
                        <p className={styles.subtitle}>
                            Read-only view of all users' bank accounts
                        </p>
                    </div>
                </div>

                <UserFilter
                    data={accounts}
                    selectedUsers={selectedUsers}
                    onChange={setSelectedUsers}
                />

                {loading ? (
                    <p className={styles.empty}>Loading...</p>
                ) : filteredAccounts.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🏦</div>
                        <p>No accounts found.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Bank</th>
                                    <th>Branch</th>
                                    <th>City</th>
                                    <th>Account No.</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccounts.map((a) => (
                                    <tr key={a.id}>
                                        <td>
                                            {a.first_name} {a.last_name}{" "}
                                            <span className={styles.cardBadge}>
                                                @{a.username}
                                            </span>
                                        </td>
                                        <td>{a.bank_name}</td>
                                        <td>{a.branch_name}</td>
                                        <td>{a.city}</td>
                                        <td>{a.account_number || "—"}</td>
                                        <td>
                                            <span className={styles.cardBadge}>
                                                {a.account_type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    // ── Regular user mode ─────────────────────────────────────────
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Banks & Accounts</h2>
                    <p className={styles.subtitle}>
                        Manage your bank branches and linked accounts
                    </p>
                </div>

                {/* Admin can add banks; regular users can only add accounts */}
                {isAdmin && tab === "banks" && (
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => setBankModal("add")}
                    >
                        + Add Bank
                    </button>
                )}
                {!isAdmin && tab === "accounts" && (
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => setAccountModal("add")}
                    >
                        + Add Account
                    </button>
                )}
            </div>

            <div className={styles.tabs}>
                {["accounts", "banks"].map((t) => (
                    <button
                        key={t}
                        className={`${styles.tab} ${
                            tab === t ? styles.tabActive : ""
                        }`}
                        onClick={() => setTab(t)}
                    >
                        {t === "accounts" ? "🏦 My Accounts" : "🏛️ Bank Master"}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className={styles.empty}>Loading...</p>
            ) : tab === "accounts" ? (
                accounts.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyIcon}>🏦</div>
                        <p>No accounts yet. Add one to get started.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Bank</th>
                                    <th>Branch</th>
                                    <th>City</th>
                                    <th>Account No.</th>
                                    <th>Type</th>
                                    {!isAdmin && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((a) => (
                                    <tr key={a.id}>
                                        <td>{a.bank_name}</td>
                                        <td>{a.branch_name}</td>
                                        <td>{a.city}</td>
                                        <td>{a.account_number || "—"}</td>
                                        <td>
                                            <span className={styles.cardBadge}>
                                                {a.account_type}
                                            </span>
                                        </td>
                                        {!isAdmin && (
                                            <td>
                                                <div
                                                    className={
                                                        styles.cardActions
                                                    }
                                                >
                                                    <button
                                                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                        onClick={() =>
                                                            setAccountModal(a)
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                        onClick={() =>
                                                            deleteAccount(a.id)
                                                        }
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : banks.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🏛️</div>
                    <p>No banks in master list yet.</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Bank Name</th>
                                <th>Branch</th>
                                <th>City</th>
                                {isAdmin && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {banks.map((b) => (
                                <tr key={b.id}>
                                    <td>{b.bank_name}</td>
                                    <td>{b.branch_name}</td>
                                    <td>{b.city}</td>
                                    {isAdmin && (
                                        <td>
                                            <div className={styles.cardActions}>
                                                <button
                                                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                                                    onClick={() =>
                                                        setBankModal(b)
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                                    onClick={() =>
                                                        deleteBank(b.id)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {bankModal && (
                <BankModal
                    existing={bankModal === "add" ? null : bankModal}
                    onSave={() => {
                        setBankModal(null);
                        load();
                    }}
                    onClose={() => setBankModal(null)}
                />
            )}

            {accountModal && (
                <AccountModal
                    existing={accountModal === "add" ? null : accountModal}
                    banks={banks}
                    userId={userId}
                    onSave={() => {
                        setAccountModal(null);
                        load();
                    }}
                    onClose={() => setAccountModal(null)}
                />
            )}
        </section>
    );
}
