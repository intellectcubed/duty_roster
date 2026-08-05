import type { NextConfig } from "next";

// Static export so the site can be served directly from GitHub Pages.
// GitHub Pages serves project sites at https://<user>.github.io/<repo>/,
// so basePath/assetPrefix must match the repo name in production builds.
const repoName = "duty_roster";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
