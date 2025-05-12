/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // чтобы не падал билд без eslint
  },
}

module.exports = nextConfig

