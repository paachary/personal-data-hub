"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./PasswordsSection.module.css";
import EntryCard from "./EntryCard";
import EntryModal from "./EntryModal";
import { VAULT_CATEGORY_LIST } from "@/constants/vaultSchemas";

export default function PasswordsSection() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editEntry, setEditEntry] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.vault.getAll();
        if (res.success) {
            await window.electronAPI.todos.syncVaultReminders(res.entries);
            setEntries(res.entries);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            await fetchEntries();
        };
        fetchData();
    }, [fetchEntries]);

    const handleSave = async (type, data) => {
        if (editEntry) {
            await window.electronAPI.vault.update(editEntry.id, data);
        } else {
            await window.electronAPI.vault.add(type, data);
        }
        await fetchEntries();
    };

    const handleDelete = async () => {
        await window.electronAPI.vault.delete(deleteId);
        setDeleteId(null);
        await fetchEntries();
    };

    const filtered = entries.filter((e) => {
        const matchesTab = activeTab === "all" || e.type === activeTab;
        const displayVal =
            Object.values(e.data).find((v) => typeof v === "string" && v) || "";
        const matchesSearch = displayVal
            .toLowerCase()
            .includes(search.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleExport = async () => {
        if (!window.electronAPI?.vault?.exportPasswords) {
            alert("Export not available.");
            return;
        }
        const res = await window.electronAPI.vault.exportPasswords();
        if (res?.success) alert("✅ Passwords exported successfully!");
        else alert("❌ Export failed. Please try again.");
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2 className={styles.title}>Passwords</h2>
                <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={handleExport}
                >
                    ⬇️ Export to Word
                </button>
            </div>
            {/* ── Toolbar ── */}
            <div className={styles.toolbar}>
                <input
                    className={styles.search}
                    placeholder="🔍  Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className={styles.addBtn}
                    onClick={() => {
                        setEditEntry(null);
                        setModalOpen(true);
                    }}
                >
                    + Add Entry
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${
                        activeTab === "all" ? styles.tabActive : ""
                    }`}
                    onClick={() => setActiveTab("all")}
                >
                    All
                </button>
                {VAULT_CATEGORY_LIST.map((cat) => (
                    <button
                        key={cat.id}
                        className={`${styles.tab} ${
                            activeTab === cat.id ? styles.tabActive : ""
                        }`}
                        onClick={() => setActiveTab(cat.id)}
                    >
                        {cat.icon} {cat.label}
                    </button>
                ))}
            </div>

            {/* ── Entries ── */}
            {loading ? (
                <div className={styles.center}>
                    <div className={styles.spinner} />
                </div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No entries found.</p>
                    <p className={styles.emptyHint}>
                        Click <strong>+ Add Entry</strong> to get started.
                    </p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtered.map((entry) => (
                        <EntryCard
                            key={entry.id}
                            entry={entry}
                            onEdit={(e) => {
                                setEditEntry(e);
                                setModalOpen(true);
                            }}
                            onDelete={setDeleteId}
                        />
                    ))}
                </div>
            )}

            {/* ── Modal ── */}
            {modalOpen && (
                <EntryModal
                    existing={editEntry}
                    onSave={handleSave}
                    onClose={() => setModalOpen(false)}
                />
            )}

            {/* ── Delete Confirm ── */}
            {deleteId && (
                <div
                    className={styles.overlay}
                    onClick={() => setDeleteId(null)}
                >
                    <div
                        className={styles.confirmBox}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className={styles.confirmText}>
                            Delete this entry? This cannot be undone.
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={`${styles.btn} ${styles.btnSecondary}`}
                                onClick={() => setDeleteId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className={`${styles.btn} ${styles.btnDanger}`}
                                onClick={handleDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
