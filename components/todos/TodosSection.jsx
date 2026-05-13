"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./TodosSection.module.css";

const PRIORITIES = [
    { value: "high", label: "High", color: "#ef4444" },
    { value: "medium", label: "Medium", color: "#f59e0b" },
    { value: "low", label: "Low", color: "#22c55e" },
];

const PRIORITY_ICON = { high: "🔴", medium: "🟡", low: "🟢" };

const EMPTY_FORM = {
    title: "",
    notes: "",
    priority: "medium",
    dueDate: "",
    remindAt: "",
};

export default function TodosSection() {
    const [todos, setTodos] = useState([]);
    const [filter, setFilter] = useState("all"); // all | pending | done
    const [showModal, setShowModal] = useState(false);
    const [editTodo, setEditTodo] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        const res = await window.electronAPI.todos.getAll();
        if (res.success) setTodos(res.todos);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = todos.filter((t) => {
        if (filter === "pending") return t.status === "pending";
        if (filter === "done") return t.status === "done";
        return true;
    });

    const pending = todos.filter((t) => t.status === "pending").length;
    const overdue = todos.filter((t) => {
        if (!t.due_date || t.status === "done") return false;
        return new Date(t.due_date) < new Date();
    }).length;

    function openAdd() {
        setEditTodo(null);
        setForm(EMPTY_FORM);
        setError("");
        setShowModal(true);
    }

    function openEdit(todo) {
        setEditTodo(todo);
        setForm({
            title: todo.title,
            notes: todo.notes || "",
            priority: todo.priority || "medium",
            dueDate: todo.due_date ? todo.due_date.slice(0, 10) : "",
            remindAt: todo.remind_at
                ? new Date(todo.remind_at).toISOString().slice(0, 16)
                : "",
        });
        setError("");
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.title.trim()) {
            setError("Title is required.");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                title: form.title.trim(),
                notes: form.notes.trim() || null,
                priority: form.priority,
                dueDate: form.dueDate || null,
                remindAt: form.remindAt
                    ? new Date(form.remindAt).toISOString()
                    : null,
            };

            if (editTodo) {
                await window.electronAPI.todos.update({
                    id: editTodo.id,
                    status: editTodo.status,
                    ...payload,
                });
            } else {
                await window.electronAPI.todos.add(payload);
            }

            setShowModal(false);
            load();
        } catch (e) {
            setError("Failed to save.");
        } finally {
            setLoading(false);
        }
    }

    async function handleToggle(id) {
        await window.electronAPI.todos.toggleDone(id);
        load();
    }

    async function handleDelete(id) {
        if (!confirm("Delete this todo?")) return;
        await window.electronAPI.todos.delete(id);
        load();
    }

    function isOverdue(todo) {
        if (!todo.due_date || todo.status === "done") return false;
        return new Date(todo.due_date) < new Date();
    }

    function isDueSoon(todo) {
        if (!todo.due_date || todo.status === "done") return false;
        const diff = new Date(todo.due_date) - new Date();
        return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 days
    }

    return (
        <div className={styles.container}>
            {/* ── Header ── */}
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>📋 To-Do & Reminders</h2>
                    <p className={styles.subtitle}>
                        {pending} pending
                        {overdue > 0 && (
                            <span className={styles.overdueChip}>
                                {" "}
                                · {overdue} overdue
                            </span>
                        )}
                    </p>
                </div>
                <button className={styles.addBtn} onClick={openAdd}>
                    + New Todo
                </button>
            </div>

            {/* ── Filter Tabs ── */}
            <div className={styles.tabs}>
                {["all", "pending", "done"].map((f) => (
                    <button
                        key={f}
                        className={`${styles.tab} ${
                            filter === f ? styles.tabActive : ""
                        }`}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className={styles.tabCount}>
                            {f === "all" ? todos.length : ""}
                            {f === "pending"
                                ? todos.filter((t) => t.status === "pending")
                                      .length
                                : ""}
                            {f === "done"
                                ? todos.filter((t) => t.status === "done")
                                      .length
                                : ""}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Todo List ── */}
            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <p>No {filter === "all" ? "" : filter} todos.</p>
                    {filter !== "done" && (
                        <button className={styles.emptyAdd} onClick={openAdd}>
                            + Add your first todo
                        </button>
                    )}
                </div>
            ) : (
                <ul className={styles.list}>
                    {filtered.map((todo) => (
                        <li
                            key={todo.id}
                            className={`${styles.item}
                                ${todo.status === "done" ? styles.done : ""}
                                ${isOverdue(todo) ? styles.overdue : ""}
                                ${isDueSoon(todo) ? styles.dueSoon : ""}
                            `}
                        >
                            {/* Checkbox */}
                            <button
                                className={styles.checkbox}
                                onClick={() => handleToggle(todo.id)}
                                title={
                                    todo.status === "done"
                                        ? "Mark pending"
                                        : "Mark done"
                                }
                            >
                                {todo.status === "done" ? "✅" : "⬜"}
                            </button>

                            {/* Content */}
                            <div className={styles.content}>
                                <div className={styles.itemHeader}>
                                    <span className={styles.itemTitle}>
                                        {todo.title}
                                    </span>
                                    <span
                                        className={styles.priorityBadge}
                                        style={{
                                            color: PRIORITIES.find(
                                                (p) => p.value === todo.priority
                                            )?.color,
                                        }}
                                    >
                                        {PRIORITY_ICON[todo.priority]}
                                        {todo.priority}
                                    </span>
                                    {todo.source === "vault" && (
                                        <span className={styles.vaultBadge}>
                                            🔐 vault
                                        </span>
                                    )}
                                </div>

                                {todo.notes && (
                                    <p className={styles.notes}>{todo.notes}</p>
                                )}

                                <div className={styles.meta}>
                                    {todo.due_date && (
                                        <span
                                            className={`${styles.metaItem} ${
                                                isOverdue(todo)
                                                    ? styles.metaOverdue
                                                    : ""
                                            }`}
                                        >
                                            📅 Due:{" "}
                                            {new Date(
                                                todo.due_date
                                            ).toLocaleDateString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                            {isOverdue(todo) && " ⚠️ Overdue"}
                                            {isDueSoon(todo) && " 🔔 Due soon"}
                                        </span>
                                    )}
                                    {todo.remind_at && (
                                        <span className={styles.metaItem}>
                                            🔔 Reminder:{" "}
                                            {new Date(
                                                todo.remind_at
                                            ).toLocaleString("en-GB", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className={styles.actions}>
                                <button
                                    className={styles.editBtn}
                                    onClick={() => openEdit(todo)}
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDelete(todo.id)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* ── Modal ── */}
            {showModal && (
                <div
                    className={styles.overlay}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <h3>{editTodo ? "Edit Todo" : "New Todo"}</h3>
                            <button
                                className={styles.close}
                                onClick={() => setShowModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <label className={styles.label}>Title *</label>
                            <input
                                className={styles.input}
                                value={form.title}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder="What needs to be done?"
                                autoFocus
                            />

                            <label className={styles.label}>Notes</label>
                            <textarea
                                className={styles.textarea}
                                value={form.notes}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        notes: e.target.value,
                                    }))
                                }
                                placeholder="Optional details..."
                                rows={3}
                            />

                            <label className={styles.label}>Priority</label>
                            <div className={styles.priorityRow}>
                                {PRIORITIES.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`${styles.priorityBtn} ${
                                            form.priority === p.value
                                                ? styles.priorityBtnActive
                                                : ""
                                        }`}
                                        style={{
                                            borderColor:
                                                form.priority === p.value
                                                    ? p.color
                                                    : undefined,
                                        }}
                                        onClick={() =>
                                            setForm((f) => ({
                                                ...f,
                                                priority: p.value,
                                            }))
                                        }
                                    >
                                        {PRIORITY_ICON[p.value]} {p.label}
                                    </button>
                                ))}
                            </div>

                            <div className={styles.row}>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Due Date
                                    </label>
                                    <input
                                        className={styles.input}
                                        type="date"
                                        value={form.dueDate}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                dueDate: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Remind Me At
                                    </label>
                                    <input
                                        className={styles.input}
                                        type="datetime-local"
                                        value={form.remindAt}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                remindAt: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            {error && <p className={styles.error}>{error}</p>}

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.saveBtn}
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Saving..."
                                        : editTodo
                                        ? "Save Changes"
                                        : "Add Todo"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
