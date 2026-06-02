"use client";

import { useState } from "react";
import styles from "./settings.module.css";
import SettingsProfilePanel from "./SettingsProfilePanel";
import SettingsPasswordPanel from "./SettingsPasswordPanel";

export default function SettingsGeneral() {
    // "profile" | "password"
    const [activeTab, setActiveTab] = useState("profile");

    return (
        <div className={styles.settingsPage}>
            {/* ── Top-level tabs ── */}
            <div className={styles.tabs}>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === "profile" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("profile")}
                >
                    👤 Profile
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === "password" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("password")}
                >
                    🔒 Password
                </button>
            </div>

            {activeTab === "profile" && <SettingsProfilePanel />}
            {activeTab === "password" && <SettingsPasswordPanel />}
        </div>
    );
}
