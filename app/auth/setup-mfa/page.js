"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/common/AuthCard";
import styles from "@/app/auth/auth.module.css";

export default function SetupMfaPage() {
    const router = useRouter();
    const [qr, setQr] = useState("");
    const [secret, setSecret] = useState("");
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState("qr"); // "qr" | "verify"

    useEffect(() => {
        window.electronAPI.auth.mfa.setup().then((res) => {
            setQr(res.qr);
            setSecret(res.secret);
        });
    }, []);

    const handleVerify = async () => {
        setError("");
        if (!token || token.length !== 6)
            return setError(
                "Please enter the 6-digit code from your authenticator app."
            );

        setLoading(true);
        const res = await window.electronAPI.auth.mfa.verifySetup({ token });
        setLoading(false);

        if (res.success) {
            router.replace("/dashboard");
        } else {
            setError(res.message);
        }
    };

    return (
        <AuthCard
            title="Set Up Two-Factor Authentication"
            subtitle="Scan the QR code with your authenticator app to continue."
        >
            <div className={styles.mfaWrapper}>
                {step === "qr" && (
                    <>
                        <p className={styles.mfaStep}>
                            <strong>Step 1:</strong> Install an authenticator
                            app on your phone.
                            <br />
                            Recommended: <strong>
                                Google Authenticator
                            </strong>, <strong>Authy</strong> or{" "}
                            <strong>Microsoft Authenticator</strong>.
                        </p>

                        <p className={styles.mfaStep}>
                            <strong>Step 2:</strong> Scan the QR code below.
                        </p>

                        {qr && (
                            <div className={styles.qrWrapper}>
                                <img
                                    src={qr}
                                    alt="MFA QR Code"
                                    className={styles.qrImage}
                                />
                            </div>
                        )}

                        <p className={styles.mfaStep}>
                            <strong>Can&apos;t scan?</strong> Enter this key
                            manually in your app:
                        </p>
                        <code className={styles.secretKey}>{secret}</code>

                        <button
                            className={styles.submitBtn}
                            onClick={() => setStep("verify")}
                        >
                            I&apos;ve scanned the QR code →
                        </button>
                    </>
                )}

                {step === "verify" && (
                    <>
                        <p className={styles.mfaStep}>
                            <strong>Step 3:</strong> Enter the 6-digit code
                            shown in your authenticator app to confirm setup.
                        </p>

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
                        />

                        {error && <p className={styles.error}>{error}</p>}

                        <div className={styles.mfaActions}>
                            <button
                                className={styles.linkBtn}
                                onClick={() => setStep("qr")}
                            >
                                ← Back
                            </button>
                            <button
                                className={styles.submitBtn}
                                onClick={handleVerify}
                                disabled={loading}
                            >
                                {loading
                                    ? "Verifying..."
                                    : "Confirm & Continue"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </AuthCard>
    );
}
