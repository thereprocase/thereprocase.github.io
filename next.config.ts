import type { NextConfig } from 'next';
// Vinext beta redirects dynamic prerender requests when trailingSlash is true.
// export-pages.mjs adds directory index aliases for the public GitHub Pages URLs.
const nextConfig: NextConfig = { output: 'export', trailingSlash: false };
export default nextConfig;
