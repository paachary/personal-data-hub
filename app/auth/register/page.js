// app/auth/register/page.js
"use client"; // ← Make sure this is at the top

import { Suspense } from "react";
import AuthCard from "@/components/common/AuthCard";
import RegisterForm from "./RegisterForm";
import AuthFooter from "@/components/common/AuthFooter";

export default function RegisterPage() {
    return (
        <AuthCard
            title="Create Account"
            subtitle="Join to secure your personal data."
        >
            <Suspense fallback={<div>Loading...</div>}>
                <RegisterForm />
            </Suspense>

            <AuthFooter
                message="Already have an account?"
                linkText="Login"
                linkHref="/auth/login"
            />
        </AuthCard>
    );
}
