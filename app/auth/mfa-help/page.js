"use client";

import styles from "./mfa-help.module.css";

const STEPS = [
    {
        icon: "📱",
        title: "Install an Authenticator App",
        content: (
            <>
                <p>Download one of the following apps on your smartphone:</p>
                <ul>
                    <li>
                        <strong>Google Authenticator</strong> — iOS / Android
                    </li>
                    <li>
                        <strong>Authy</strong> — iOS / Android / Desktop
                    </li>
                    <li>
                        <strong>Microsoft Authenticator</strong> — iOS / Android
                    </li>
                </ul>
            </>
        ),
    },
    {
        icon: "📷",
        title: "Scan the QR Code",
        content: (
            <>
                <p>
                    During registration or first login, you will be shown a QR
                    code. Open your authenticator app, tap{" "}
                    <strong>&ldquo;+&rdquo;</strong> or{" "}
                    <strong>&ldquo;Add Account&rdquo;</strong>, then select{" "}
                    <strong>&ldquo;Scan QR Code&rdquo;</strong>.
                </p>
                <p>
                    If you cannot scan the QR code, use the{" "}
                    <strong>manual entry key</strong>
                    shown on the same screen.
                </p>
            </>
        ),
    },
    {
        icon: "🔢",
        title: "Enter the 6-Digit Code",
        content: (
            <>
                <p>
                    After scanning, your app will display a 6-digit code that
                    refreshes every <strong>30 seconds</strong>. Enter this code
                    when prompted during login.
                </p>
                <p>
                    Make sure your device&apos;s time is accurate — TOTP codes
                    are time-based and will fail if your device clock is off by
                    more than 30 seconds.
                </p>
            </>
        ),
    },
    {
        icon: "🔒",
        title: "Keep Your Device Safe",
        content: (
            <>
                <p>
                    Your authenticator app is the second layer of your account
                    security. Treat it like your password:
                </p>
                <ul>
                    <li>Do not share your QR code or manual key with anyone</li>
                    <li>Enable a lock screen PIN on your phone</li>
                    <li>
                        Use <strong>Authy</strong> if you want encrypted cloud
                        backup of your authenticator codes
                    </li>
                </ul>
            </>
        ),
    },
    {
        icon: "🆘",
        title: "Lost Access to Your Authenticator?",
        content: (
            <>
                <p>
                    If you lose access to your authenticator app (e.g.
                    lost/replaced phone), you <strong>cannot log in</strong>{" "}
                    without MFA reset.
                </p>
                <p>
                    Contact your <strong>Admin</strong> to reset your MFA. The
                    admin can:
                </p>
                <ul>
                    <li>
                        Go to <strong>User Management</strong>
                    </li>
                    <li>Find your account</li>
                    <li>
                        Click <strong>🔐 Reset MFA</strong>
                    </li>
                </ul>
                <p>
                    On your next login, you will be prompted to set up MFA again
                    with a new QR code.
                </p>
            </>
        ),
    },
    {
        icon: "👑",
        title: "Admin — Resetting MFA for Users",
        content: (
            <>
                <p>As an admin, you can reset MFA for any user:</p>
                <ol>
                    <li>Log in as Admin</li>
                    <li>
                        Go to <strong>User Management</strong> in the sidebar
                    </li>
                    <li>Find the user in the table</li>
                    <li>
                        Click <strong>🔐 Reset MFA</strong>
                    </li>
                    <li>Confirm the action</li>
                </ol>
                <p>
                    The user&apos;s MFA will be cleared. On their next login,
                    they will be directed to set up MFA again.
                </p>
                <p>
                    ⚠️ <strong>Note:</strong> Even admins cannot bypass MFA — it
                    is mandatory for all accounts including admin accounts.
                </p>
            </>
        ),
    },
];

export default function MfaHelpPage() {
    return (
        <div className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroIcon}>🔐</div>
                <h1 className={styles.heroTitle}>
                    Two-Factor Authentication (MFA)
                </h1>
                <p className={styles.heroSubtitle}>
                    MFA adds a second layer of security to your account. Even if
                    your password is compromised, your account stays protected.
                </p>
            </div>

            <div className={styles.steps}>
                {STEPS.map((step, i) => (
                    <div key={i} className={styles.step}>
                        <div className={styles.stepIcon}>{step.icon}</div>
                        <div className={styles.stepBody}>
                            <h2 className={styles.stepTitle}>{step.title}</h2>
                            <div className={styles.stepContent}>
                                {step.content}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
