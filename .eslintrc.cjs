module.exports = {
  extends: ["next/core-web-vitals"],
  plugins: ["imx"],
  rules: {
    "imx/no-tailwind-border": "error",
  },
};
