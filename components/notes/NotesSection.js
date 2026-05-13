"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./NotesSection.module.css";
import NoteModal from "./NoteModal";

export default function NotesSection() {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editNote, setEditNote] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    // ← moved outside useEffect so it can be reused
    const fetchNotes = useCallback(async () => {
        setLoading(true);
        const res = await window.electronAPI.notes.getAll();
        if (res.success) setNotes(res.notes);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const handleSave = async (data) => {
        try {
            let res;
            if (editNote) {
                res = await window.electronAPI.notes.update(editNote.id, data);
            } else {
                res = await window.electronAPI.notes.add(data);
            }
            if (res?.success) {
                setModalOpen(false); // ← close modal on success
                setEditNote(null);
                await fetchNotes();
            } else {
                alert(res?.message ?? "Failed to save note.");
            }
        } catch (e) {
            console.error("[handleSave]", e);
            alert("Failed to save note.");
        }
    };

    const handleDelete = async () => {
        try {
            await window.electronAPI.notes.delete(deleteId);
            setDeleteId(null);
            await fetchNotes();
        } catch (e) {
            console.error("[handleDelete]", e);
        }
    };

    const filtered = notes.filter((n) =>
        n.data.label?.toLowerCase().includes(search.toLowerCase())
    );

    const handleExport = async () => {
        const res = await window.electronAPI.vault.exportNotes();
        if (res?.success) alert("✅ Notes exported successfully!");
        else alert("❌ Export failed. Please try again.");
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2 className={styles.title}>Notes</h2>
                <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={handleExport}
                >
                    ⬇️ Export to Word
                </button>
            </div>
            <div className={styles.toolbar}>
                <input
                    className={styles.search}
                    placeholder="🔍  Search notes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className={styles.addBtn}
                    onClick={() => {
                        setEditNote(null);
                        setModalOpen(true);
                    }}
                >
                    + Add Note
                </button>
            </div>

            {loading ? (
                <div className={styles.center}>
                    <div className={styles.spinner} />
                </div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No notes yet.</p>
                    <p className={styles.emptyHint}>
                        Click <strong>+ Add Note</strong> to create your first
                        note.
                    </p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtered.map((note) => (
                        <div key={note.id} className={styles.noteCard}>
                            <div className={styles.noteTop}>
                                <div className={styles.noteMeta}>
                                    <span className={styles.noteIcon}>📝</span>
                                    <p className={styles.noteLabel}>
                                        {note.data.label}
                                    </p>
                                </div>
                                <div className={styles.noteActions}>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() =>
                                            setExpandedId(
                                                expandedId === note.id
                                                    ? null
                                                    : note.id
                                            )
                                        }
                                    >
                                        {expandedId === note.id ? "▲" : "▼"}
                                    </button>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => {
                                            setEditNote(note);
                                            setModalOpen(true);
                                        }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => setDeleteId(note.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            {note.data.description && (
                                <p className={styles.noteDescription}>
                                    {note.data.description}
                                </p>
                            )}

                            {expandedId === note.id && (
                                <div className={styles.noteBody}>
                                    {note.data.keyValuePairs?.length > 0 && (
                                        <div className={styles.kvList}>
                                            {note.data.keyValuePairs.map(
                                                (pair, i) => (
                                                    <div
                                                        key={i}
                                                        className={styles.kvRow}
                                                    >
                                                        <span
                                                            className={
                                                                styles.kvKey
                                                            }
                                                        >
                                                            {pair.key}
                                                        </span>
                                                        <span
                                                            className={
                                                                styles.kvValue
                                                            }
                                                        >
                                                            {pair.value}
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                    {note.data.url && (
                                        <a
                                            className={styles.noteUrl}
                                            href={note.data.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            🔗 {note.data.url}
                                        </a>
                                    )}
                                    {note.data.notes && (
                                        <p className={styles.noteExtra}>
                                            {note.data.notes}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <NoteModal
                    existing={editNote}
                    onSave={handleSave}
                    onClose={() => setModalOpen(false)}
                />
            )}

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
                            Delete this note? This cannot be undone.
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
