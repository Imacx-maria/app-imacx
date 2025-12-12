module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  plugins: ["imx"],
  rules: {
    "imx/no-tailwind-border": "error",
  },
};
