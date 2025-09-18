/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('@node-rs/argon2', '@node-rs/bcrypt')
    return config
  },
  // Zwiększ timeout dla API routes (domyślnie 10s)
  experimental: {
    serverTimeout: 300000, // 5 minut
  }
}

module.exports = nextConfig 