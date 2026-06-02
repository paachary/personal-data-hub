import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "Personal Data Hub",
    description:
        "A secure and user-friendly desktop application for managing personal data, built with Electron and Next.js.",
};

export default function RootLayout({ children }) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable}`}
        >
            <body>{children}</body>
        </html>
    );
}

export const dynamic = "force-static";
export const dynamicParams = false;
