const staticExport = !!process.env.STATIC_EXPORT;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false,
  basePath,
  trailingSlash: staticExport,
  ...(staticExport && { output: 'export' }),
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SERVER_ADDR: process.env.NEXT_PUBLIC_SERVER_ADDR || process.env.SERVER_ADDR || 'localhost:8080',
    NEXT_PUBLIC_WS_ADDR: process.env.NEXT_PUBLIC_WS_ADDR || process.env.WS_ADDR || 'localhost:8081',
    NEXT_PUBLIC_DEFAULT_MODE: process.env.NEXT_PUBLIC_DEFAULT_MODE || 'online',
  },
};
