/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('@node-rs/argon2', '@node-rs/bcrypt')
    return config
  },
  // Zwiększ timeout dla API routes
  api: {
    responseLimit: false,
    externalResolver: true,
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Alternatywne ustawienie timeoutu
  serverRuntimeConfig: {
    maxDuration: 300, // 5 minut w sekundach
  }
}

module.exports = nextConfig 