import path from "node:path";
import { fileURLToPath } from "node:url";

// Racine du repo : l'app importe du code partagé situé hors de web/ (../shared).
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
