import AuthCard from "@/components/common/AuthCard";
import AuthFooter from "@/components/common/AuthFooter";
import LoginForm from "./LoginForm"; // Import the client component

export default function LoginPage() {
    return (
        <AuthCard
            title="Welcome Back"
            subtitle="Sign in to access your vault."
            compact
        >
            <LoginForm />

            <AuthFooter
                message="Don't have an account?"
                linkText="Register"
                linkHref="/auth/register"
            />
        </AuthCard>
    );
}
