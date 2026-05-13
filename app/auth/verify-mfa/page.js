"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/common/AuthCard";
import styles from "@/app/auth/auth.module.css";

export default function VerifyMfaPage() {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        setError("");
        if (!token || token.length !== 6)
            return setError("Please enter the 6-digit code.");

        setLoading(true);
        const res = await window.electronAPI.auth.mfa.verifyLogin({ token });
        setLoading(false);

        if (res.success) {
            router.replace("/dashboard");
        } else {
            setError(res.message);
        }
    };

    return (
        <AuthCard
            title="Two-Factor Authentication"
            subtitle="Enter the 6-digit code from your authenticator app."
        >
            <div className={styles.mfaWrapper}>
                <input
                    className={styles.otpInput}
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={token}
                    onChange={(e) =>
                        setToken(e.target.value.replace(/\D/g, ""))
                    }
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />

                {error && <p className={styles.error}>{error}</p>}

                <button
                    className={styles.submitBtn}
                    onClick={handleVerify}
                    disabled={loading}
                >
                    {loading ? "Verifying..." : "Verify"}
                </button>

                <p className={styles.mfaHint}>
                    Lost access to your authenticator app? Contact your admin to
                    reset MFA.
                </p>
            </div>
        </AuthCard>
    );
}
