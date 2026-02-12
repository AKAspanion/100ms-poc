interface PostCSSConfig {
  plugins: Record<string, Record<string, unknown> | boolean>;
}

const config: PostCSSConfig = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
