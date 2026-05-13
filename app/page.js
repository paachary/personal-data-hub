// app/page.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Check if user is authenticated
        const checkAuth = async () => {
            if (typeof window !== "undefined" && window.electronAPI) {
                const session = await window.electronAPI.getSession();
                if (session?.isLoggedIn) {
                    router.replace("/dashboard");
                } else {
                    router.replace("/auth/login");
                }
            } else {
                router.replace("/auth/login");
            }
        };

        checkAuth();
    }, [router]);

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                background: "#0f172a",
                color: "#e2e8f0",
            }}
        >
            Loading...
        </div>
    );
}
