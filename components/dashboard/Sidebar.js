import styles from "./Sidebar.module.css";
import { NAV_SECTIONS, ADMIN_SETTINGS_SECTIONS } from "@/constants/sections";

export default function Sidebar({
    username,
    activeSection,
    onSectionChange,
    onLogout,
    isAdmin,
}) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <div className={styles.logo}>🔐 Personal Data</div>
            </div>

            <nav className={styles.nav}>
                {NAV_SECTIONS.map(({ group, items }) => (
                    <div key={group}>
                        <p className={styles.navGroup}>{group}</p>
                        {items
                            .filter(({ id }) => {
                                // Admin should not see personal Banks/Investments tabs
                                if (
                                    isAdmin &&
                                    ["banks", "investments"].includes(id)
                                )
                                    return false;
                                return true;
                            })
                            .map(({ id, label }) => (
                                <button
                                    key={id}
                                    className={`${styles.navItem} ${
                                        activeSection === id
                                            ? styles.navItemActive
                                            : ""
                                    }`}
                                    onClick={() => onSectionChange(id)}
                                >
                                    {label}
                                </button>
                            ))}

                        {/* Admin-only: view all users data */}
                        {group === "Finance" && isAdmin && (
                            <div className={styles.adminSubNav}>
                                <p className={styles.navSubGroup}>All Users</p>
                                {[
                                    {
                                        id: "admin-all-banks",
                                        label: "💳 All Accounts",
                                    },
                                    {
                                        id: "admin-all-investments",
                                        label: "📈 All Investments",
                                    },
                                    {
                                        id: "reports-investments",
                                        label: "📊 Reports",
                                    },
                                ].map(({ id, label }) => (
                                    <button
                                        key={id}
                                        className={`${styles.navItem} ${
                                            styles.navItemIndented
                                        } ${
                                            activeSection === id
                                                ? styles.navItemActive
                                                : ""
                                        }`}
                                        onClick={() => onSectionChange(id)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Admin-only settings */}
                        {group === "Settings" && isAdmin && (
                            <div className={styles.adminSubNav}>
                                <p className={styles.navSubGroup}>Admin</p>
                                {ADMIN_SETTINGS_SECTIONS.map(
                                    ({ id, label }) => (
                                        <button
                                            key={id}
                                            className={`${styles.navItem} ${
                                                styles.navItemIndented
                                            } ${
                                                activeSection === id
                                                    ? styles.navItemActive
                                                    : ""
                                            }`}
                                            onClick={() => onSectionChange(id)}
                                        >
                                            {label}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className={styles.sidebarFooter}>
                <div className={styles.userBadge}>
                    <div className={styles.avatar}>
                        {username?.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.usernameLabel}>{username}</span>
                </div>
                <button className={styles.logoutButton} onClick={onLogout}>
                    Logout
                </button>
            </div>
        </aside>
    );
}
