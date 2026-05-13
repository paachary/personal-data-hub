"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import PasswordsSection from "@/components/vault/PasswordsSection";
import NotesSection from "@/components/notes/NotesSection";
import BanksSection from "@/components/finance/BanksSection";
import InvestmentsSection from "@/components/finance/InvestmentsSection";
import SettingsBankMaster from "@/components/settings/SettingsBankMaster";
import SettingsInstrumentTypes from "@/components/settings/SettingsInstrumentTypes";
import SettingsInvestmentTypes from "@/components/settings/SettingsInvestmentTypes";
import SettingsGeneral from "@/components/settings/SettingsGeneral";
import AdminRestrictedSection from "@/components/common/AdminRestrictedSection";
import FinancePage from "@/app/finance/page";
import AdminUsersSection from "@/components/admin/AdminUsersSection";
import MfaHelpPage from "@/app/auth/mfa-help/page";
import TodosSection from "@/components/todos/TodosSection"; // ← Add

import { SECTION_SUBTITLES, SECTION_TITLES } from "@/constants/sections";

import useInactivityLogout from "@/hooks/useInactivityLogout";

export default function DashboardPage() {
    const router = useRouter();
    const [username, setUsername] = useState(null);
    const [fullName, setFullName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState("dashboard");
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState(null);

    const handleLogout = useCallback(async () => {
        await window.electronAPI.logout();
        router.replace("/auth/login"); // no reason param
    }, [router]);

    const handleInactivityLogout = useCallback(async () => {
        await window.electronAPI.logout();
        localStorage.setItem("sessionTimedOut", "true"); // ← Set flag before redirect

        router.replace("/auth/login?reason=inactive");
    }, [router]);

    useEffect(() => {
        window.electronAPI.setHelpSection(activeSection);
    }, [activeSection]);

    useInactivityLogout(handleInactivityLogout); // ← use separate fn

    useEffect(() => {
        async function checkSession() {
            if (
                typeof window === "undefined" ||
                !window.electronAPI?.getSession
            ) {
                router.replace("/auth/login");
                return;
            }
            const session = await window.electronAPI.getSession();
            if (!session.isLoggedIn) {
                router.replace("/auth/login");
                return;
            }
            setUsername(session.username);
            setFullName(session.fullName);
            setIsAdmin(session.isAdmin); // ← add
            setUserId(session.userId); // ← add
            setLoading(false);
        }
        checkSession();
    }, [router]);

    // Removed duplicate handleLogout function

    if (loading) {
        return (
            <div className={styles.loadingWrapper}>
                <div className={styles.spinner} />
            </div>
        );
    }

    return (
        <div className={styles.pageWrapper}>
            <Sidebar
                username={username}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onLogout={handleLogout}
                isAdmin={isAdmin} // ← pass isAdmin
            />

            <main className={styles.main}>
                <header className={styles.header}>
                    <h1 className={styles.greeting}>
                        Welcome back, {fullName} 👋
                    </h1>
                    <p className={styles.subtext}>
                        {SECTION_SUBTITLES[activeSection]}
                    </p>
                </header>
                {activeSection === "dashboard" && (
                    <DashboardOverview userId={userId} />
                )}
                {activeSection === "passwords" &&
                    (isAdmin ? (
                        <AdminRestrictedSection section="Passwords" />
                    ) : (
                        <PasswordsSection />
                    ))}
                {activeSection === "notes" &&
                    (isAdmin ? (
                        <AdminRestrictedSection section="Notes" />
                    ) : (
                        <NotesSection />
                    ))}
                {activeSection === "investments" && !isAdmin && (
                    <InvestmentsSection userId={userId} />
                )}
                {activeSection === "banks" && !isAdmin && (
                    <BanksSection userId={userId} isAdmin={isAdmin} />
                )}
                {/* Admin-only settings */}
                {activeSection === "settings" && <SettingsGeneral />}
                {activeSection === "settings-banks" && isAdmin && (
                    <SettingsBankMaster />
                )}
                {activeSection === "settings-instrument-types" && isAdmin && (
                    <SettingsInstrumentTypes />
                )}
                {activeSection === "settings-investment-types" && isAdmin && (
                    <SettingsInvestmentTypes />
                )}
                {/* Admin: view all users */}
                {activeSection === "admin-all-banks" && isAdmin && (
                    <BanksSection userId={null} isAdmin={true} viewAll={true} />
                )}
                {activeSection === "admin-all-investments" && isAdmin && (
                    <InvestmentsSection
                        userId={null}
                        isAdmin={true}
                        viewAll={true}
                    />
                )}
                {activeSection === "reports-investments" && isAdmin && (
                    <FinancePage />
                )}
                {activeSection === "admin-users" && isAdmin && (
                    <AdminUsersSection />
                )}
                {activeSection === "mfa-help" && <MfaHelpPage />}
                {activeSection === "todos" && // ← Add
                    (isAdmin ? (
                        <AdminRestrictedSection section="To-Do & Reminders" />
                    ) : (
                        <TodosSection />
                    ))}
                {/* Only show "coming soon" for sections that don't have a component yet */}
                {![
                    "dashboard",
                    "passwords",
                    "notes",
                    "todos",
                    "investments",
                    "banks",
                    "admin-all-banks",
                    "admin-all-investments",
                    "settings",
                    "settings-banks",
                    "settings-instrument-types",
                    "settings-investment-types",
                    "admin-users",
                    "reports-investments",
                    "mfa-help",
                ].includes(activeSection) && (
                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>
                            {SECTION_TITLES[activeSection]}
                        </h2>
                        <div className={styles.emptyState}>
                            <p>Nothing here yet.</p>
                            <p className={styles.emptyHint}>
                                This section is coming soon.
                            </p>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
