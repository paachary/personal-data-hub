"use client";

import styles from "./settings.module.css";

export default function PersonalInfoPanel({ profile, setProfile }) {
    const set = (field) => (e) =>
        setProfile((p) => ({ ...p, [field]: e.target.value }));

    return (
        <>
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label}>
                        First Name <span className={styles.required}>*</span>
                    </label>
                    <input
                        className={styles.input}
                        value={profile.firstName}
                        onChange={set("firstName")}
                        placeholder="John"
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label}>Last Name</label>
                    <input
                        className={styles.input}
                        value={profile.lastName}
                        onChange={set("lastName")}
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
                    onChange={set("email")}
                    placeholder="john@example.com"
                />
            </div>
            <div className={styles.row}>
                <div className={styles.field}>
                    <label className={styles.label}>Mobile Number</label>
                    <input
                        className={styles.input}
                        type="tel"
                        value={profile.phone}
                        onChange={set("phone")}
                        placeholder="+44 7700 900000"
                    />
                </div>
                <div style={{ flex: 1 }} />
            </div>
        </>
    );
}
