import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/owner/:path*", destination: "/admin/:path*", permanent: false },
      { source: "/reception/:path*", destination: "/admin/reception/:path*", permanent: false },
      { source: "/trainer/:path*", destination: "/admin/trainer/:path*", permanent: false },
      { source: "/member/dashboard", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
