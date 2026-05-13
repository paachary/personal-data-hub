/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    distDir: "out",
    reactCompiler: true,
    trailingSlash: true,
    assetPrefix: "", // ← Change from "." to empty string for custom protocol
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
