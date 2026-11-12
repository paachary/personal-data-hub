"use client";

import { useEffect, useState } from "react";
import taxStyles from "./tax.module.css";
import OverviewTab from "./OverviewTab";
import TaxPage from "./TaxPage";
import IncomeTab from "./IncomeTab";
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

export default function AdvanceTaxSection({ onOpenInvestments }) {
    const [yearsWithData, setYearsWithData] = useState([]);
    const [yearsError, setYearsError] = useState("");
    const [fy, setFy] = useState(currentFy());
    const [activeTab, setActiveTab] = useState("other-income");

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
        <section className={taxStyles.taxSection}>
            <div className={taxStyles.fyRow}>
                <label className={taxStyles.fyLabel} htmlFor="tax-fy">
                    Financial year
                </label>
                <select
                    id="tax-fy"
                    className={taxStyles.fySelect}
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

            <div className={taxStyles.outerTabs} role="tablist" aria-label="Advance tax sections">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`tax-outer-tab-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        aria-controls="tax-outer-panel"
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={taxStyles.outerTab}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id="tax-outer-panel" aria-labelledby={`tax-outer-tab-${activeTab}`} className={taxStyles.outerPanel}>

            {activeTab === "other-income" && (
                <IncomeTab key={fy} fy={fy} onOpenInvestments={onOpenInvestments} exemption112A={exemption112A} />
            )}
            {activeTab === "tax-liability" && <TaxPage key={fy} fy={fy} unverified={unverified} />}
            {activeTab === "advance-tax-schedule" && (
                <>
                    <OverviewTab key={`schedule-${fy}`} fy={fy} view="schedule" />
                    <PaymentsTab key={fy} fy={fy} />
                </>
            )}
            {activeTab === "reference" && <ReferenceTab rules={RULES_BY_FY[fy] ?? null} />}
            </div>
        </section>
    );
}
