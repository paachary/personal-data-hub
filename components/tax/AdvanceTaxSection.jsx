"use client";

import { useEffect, useState } from "react";
import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";
import OverviewTab from "./OverviewTab";
import ProfileTab from "./ProfileTab";
import IncomeTab from "./IncomeTab";
import CapitalGainsTab from "./CapitalGainsTab";
import PaymentsTab from "./PaymentsTab";
import ReferenceTab from "./ReferenceTab";
import rules2024 from "@/lib/tax/rules/fy2024-25.json";
import rules2025 from "@/lib/tax/rules/fy2025-26.json";
import rules2026 from "@/lib/tax/rules/fy2026-27.json";

const RULES_BY_FY = {
    "2024-25": rules2024,
    "2025-26": rules2025,
    "2026-27": rules2026,
};

const TABS = [
    { id: "other-income", label: "Other Income" },
    { id: "tax-liability", label: "Tax Liability" },
    { id: "advance-tax-schedule", label: "Advance Tax Schedule" },
    { id: "reference", label: "Reference" },
];

// Indian FY runs 1 April to 31 March, so April onwards belongs to the FY starting this year.
function currentFy(now = new Date()) {
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export default function AdvanceTaxSection() {
    const [yearsWithData, setYearsWithData] = useState([]);
    const [yearsError, setYearsError] = useState("");
    const [fy, setFy] = useState(currentFy());
    const [activeTab, setActiveTab] = useState("other-income");
    const [profileVersion, setProfileVersion] = useState(0);

    useEffect(() => {
        let active = true;
        window.electronAPI.tax
            .financialYears()
            .then((years) => {
                if (active) setYearsWithData(Array.isArray(years) ? years : []);
            })
            .catch((err) => {
                if (active) setYearsError(err.message || "Could not load financial years.");
            });
        return () => {
            active = false;
        };
    }, []);

    const fyOptions = [...new Set([currentFy(), ...yearsWithData])].sort().reverse();

    const unverified = RULES_BY_FY[fy]?.unverified === true;
    const periods = RULES_BY_FY[fy]?.capitalGains?.periods || [];
    const exemption112A = periods[periods.length - 1]?.ltcg112AExemption?.value ?? null;

    return (
        <section className={`${styles.section} ${taxStyles.taxSection}`}>
            <div className={taxStyles.fyRow}>
                <label className={taxStyles.fyLabel} htmlFor="tax-fy">
                    Financial year
                </label>
                <select
                    id="tax-fy"
                    className={styles.select}
                    value={fy}
                    onChange={(e) => setFy(e.target.value)}
                >
                    {fyOptions.map((option) => (
                        <option key={option} value={option}>
                            FY {option}
                        </option>
                    ))}
                </select>
            </div>

            {yearsError && <div className={taxStyles.error}>{yearsError}</div>}

            <div className={`${taxStyles.banner} ${taxStyles.disclaimer}`} role="note">
                Estimates only, not tax advice. Verify on the Income Tax portal or with a CA.
            </div>

            {unverified && (
                <div className={`${taxStyles.banner} ${taxStyles.warning}`} role="alert">
                    The tax rules for FY {fy} are unverified. Results are indicative only.
                </div>
            )}

            <div className={styles.tabs} role="tablist">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "other-income" && (
                <>
                    <IncomeTab key={fy} fy={fy} />
                    <CapitalGainsTab key={fy} fy={fy} exemption={exemption112A} />
                </>
            )}
            {activeTab === "tax-liability" && (
                <>
                    <ProfileTab key={fy} fy={fy} onSaved={() => setProfileVersion((v) => v + 1)} />
                    <OverviewTab key={`liability-${fy}-${profileVersion}`} fy={fy} view="liability" />
                </>
            )}
            {activeTab === "advance-tax-schedule" && (
                <>
                    <OverviewTab key={`schedule-${fy}`} fy={fy} view="schedule" />
                    <PaymentsTab key={fy} fy={fy} />
                </>
            )}
            {activeTab === "reference" && <ReferenceTab rules={RULES_BY_FY[fy] ?? null} />}
        </section>
    );
}
