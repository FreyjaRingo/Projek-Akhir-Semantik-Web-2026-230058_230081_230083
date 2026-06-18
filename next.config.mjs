/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
      },
      {
        protocol: 'https',
        hostname: '*.myanimelist.net',
      },
      {
        protocol: 'https',
        hostname: 'images.animecharactersdatabase.com',
      },
    ],
  },

  // Experimental features
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './src',
      },
    },
  },
};

export default nextConfig;
