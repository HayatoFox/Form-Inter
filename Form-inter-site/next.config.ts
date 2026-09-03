import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // La recherche cartographique a vécu quelque temps sous `/carte` avant
        // de devenir l'accueil. Les liens déjà partagés continuent de marcher :
        // les paramètres de requête sont transmis tels quels par Next, donc une
        // adresse et des filtres arrivent intacts.
        source: "/carte",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
