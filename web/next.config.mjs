// @ts-check
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  images: {
    unoptimized: true, // required for static export
  },
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
};

export default config;
