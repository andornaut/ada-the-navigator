export default {
  "*.{js,mjs,ts}": ["prettier --write", "eslint --fix --max-warnings 0"],
  "*.{json,yaml,yml,css,html}": "prettier --write",
  "*.md": ["prettier --write", "markdownlint-cli2"],
};
