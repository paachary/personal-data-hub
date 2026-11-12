"use client";

import { useRef } from "react";
import styles from "./taxPage.module.css";

const TABS = [
    { id: "inputs", label: "Inputs" },
    { id: "summary", label: "Summary" },
    { id: "slabs", label: "Slabs" },
    { id: "assumptions", label: "Assumptions" },
];

export default function TabBar({ fy, unverified, activeTab, onSelect }) {
    const tabRefs = useRef({});

    const handleKeyDown = (event) => {
        const index = TABS.findIndex((tab) => tab.id === activeTab);
        let nextIndex = null;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = TABS.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        const nextId = TABS[nextIndex].id;
        onSelect(nextId);
        tabRefs.current[nextId]?.focus();
    };

    return (
        <div className={styles.tabRow}>
            <h2 className={styles.title}>Tax liability</h2>
            {unverified && (
                <button type="button" className={styles.indicative} onClick={() => onSelect("assumptions")}>
                    Indicative: FY {fy} rules unverified
                </button>
            )}
            <div role="tablist" aria-label="Tax liability sections" className={styles.tablist} onKeyDown={handleKeyDown}>
                {TABS.map((tab) => {
                    const active = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            ref={(el) => {
                                tabRefs.current[tab.id] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`tax-tab-${tab.id}`}
                            aria-selected={active}
                            aria-controls={`tax-panel-${tab.id}`}
                            tabIndex={active ? 0 : -1}
                            className={styles.tab}
                            onClick={() => onSelect(tab.id)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
