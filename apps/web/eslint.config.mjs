import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...nextConfig,
];

export default eslintConfig;
