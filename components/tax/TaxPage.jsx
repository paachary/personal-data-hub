"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./taxPage.module.css";
import { errorMessage } from "./format";
import { autoOtherIncome, summarizeOverview } from "./overviewSummary";
import { formToPayload, profileToForm } from "../../lib/tax/fieldUtils";
import SummaryTab from "./SummaryTab";
import SlabsTab from "./SlabsTab";
import AssumptionsTab from "./AssumptionsTab";
import PageHeader from "./PageHeader";
import TabBar from "./TabBar";
import InputsTab from "./InputsTab";

const TAB_IDS = ["inputs", "summary", "slabs", "assumptions"];
const TAB_STORAGE_KEY = "taxPage.activeTab";
const DRAFT_DEBOUNCE_MS = 250;

function readStoredTab() {
    if (typeof window === "undefined") return "inputs";
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    return TAB_IDS.includes(stored) ? stored : "inputs";
}

// The draft sent for live results is the saved payload without notes and reminders, which do not affect the calculation.
function draftFrom(payload) {
    return Object.fromEntries(
        Object.entries(payload).filter(([key]) => key !== "notes" && key !== "reminders_enabled"),
    );
}

function Panel({ id, active, children }) {
    return (
        <div role="tabpanel" id={`tax-panel-${id}`} aria-labelledby={`tax-tab-${id}`} hidden={!active}
            className={styles.tabPanel}>
            {children}
        </div>
    );
}

export default function TaxPage({ fy, unverified }) {
    const [form, setForm] = useState(null);
    const [savedSnapshot, setSavedSnapshot] = useState("");
    const [loadError, setLoadError] = useState("");
    const [overview, setOverview] = useState(null);
    const [overviewError, setOverviewError] = useState("");
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notice, setNotice] = useState({ kind: "", text: "" });
    const [activeTab, setActiveTab] = useState(readStoredTab);

    const selectTab = (id) => {
        setActiveTab(id);
        window.localStorage.setItem(TAB_STORAGE_KEY, id);
    };

    // The parent renders this component with key={fy}, so the profile is loaded once per year.
    useEffect(() => {
        let active = true;
        window.electronAPI.tax.profile
            .get(fy)
            .then((profile) => {
                if (!active) return;
                const loaded = profileToForm(profile);
                setForm(loaded);
                setSavedSnapshot(JSON.stringify(loaded));
            })
            .catch((err) => {
                if (active) setLoadError(errorMessage(err, "Could not load the tax profile."));
            });
        return () => {
            active = false;
        };
    }, [fy]);

    const parsed = useMemo(() => (form ? formToPayload(form) : null), [form]);
    const validationError = parsed?.error ?? "";
    const draftKey = parsed?.payload ? JSON.stringify(draftFrom(parsed.payload)) : "";
    const dirty = form !== null && JSON.stringify(form) !== savedSnapshot;

    // Live results. The cleanup flag drops responses from superseded drafts. While the form is invalid, the last valid result stays on screen.
    useEffect(() => {
        if (!draftKey) return undefined;
        const draft = JSON.parse(draftKey);
        let active = true;
        const timer = setTimeout(() => {
            window.electronAPI.tax
                .getOverview(fy, draft)
                .then((data) => {
                    if (!active) return;
                    setOverview(data);
                    setOverviewError("");
                })
                .catch((err) => {
                    if (active) setOverviewError(errorMessage(err, "Could not calculate tax."));
                });
        }, DRAFT_DEBOUNCE_MS);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [fy, draftKey]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        if (!parsed?.payload) return;
        setSaving(true);
        setNotice({ kind: "", text: "" });
        try {
            await window.electronAPI.tax.profile.save({ fy, ...parsed.payload });
            setSavedSnapshot(JSON.stringify(form));
            setNotice({ kind: "info", text: "Tax profile saved." });
        } catch (err) {
            setNotice({ kind: "error", text: errorMessage(err, "Could not save the tax profile.") });
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (kind) => {
        setExporting(true);
        setNotice({ kind: "", text: "" });
        try {
            const api = window.electronAPI.tax;
            const result = kind === "excel" ? await api.exportExcel(fy) : await api.exportWord(fy);
            if (result?.success) setNotice({ kind: "info", text: `Exported ${kind === "excel" ? "Excel" : "Word"} file.` });
        } catch (err) {
            setNotice({ kind: "error", text: errorMessage(err, "Export failed.") });
        } finally {
            setExporting(false);
        }
    };

    if (loadError) {
        return (
            <div className={styles.page}>
                <div className={styles.body}>
                    <p role="alert" className={styles.statusError}>{loadError}</p>
                </div>
            </div>
        );
    }

    const summary = summarizeOverview(overview);
    const otherIncome = overview ? autoOtherIncome(overview.incomeTotals) : 0;
    const headerNotice = notice.text ? notice : overviewError ? { kind: "error", text: overviewError } : null;

    return (
        <div className={styles.page}>
            <PageHeader
                summary={summary}
                canSave={dirty && !validationError}
                dirty={dirty}
                saving={saving}
                exporting={exporting}
                notice={headerNotice}
                onSave={handleSave}
                onExport={handleExport}
            />
            <TabBar fy={fy} unverified={unverified} activeTab={activeTab} onSelect={selectTab} />

            <div className={styles.body}>
                <Panel id="inputs" active={activeTab === "inputs"}>
                    {form ? (
                        <InputsTab form={form} set={set} otherIncome={otherIncome} validationError={validationError} />
                    ) : (
                        <p className={styles.status}>Loading profile…</p>
                    )}
                </Panel>
                <Panel id="summary" active={activeTab === "summary"}>
                    <SummaryTab fy={fy} overview={overview} summary={summary} />
                </Panel>
                <Panel id="slabs" active={activeTab === "slabs"}>
                    <SlabsTab fy={fy} overview={overview} />
                </Panel>
                <Panel id="assumptions" active={activeTab === "assumptions"}>
                    <AssumptionsTab fy={fy} overview={overview} />
                </Panel>
            </div>
        </div>
    );
}
