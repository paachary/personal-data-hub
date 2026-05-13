const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const HELP_DIR = path.join(__dirname, "../help");

function getHelpContent(page) {
    const filePath = path.join(HELP_DIR, `${page}.md`);
    const md = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf-8")
        : `# Help\n\nNo help available for this page yet.`;
    return marked.parse(md);
}

module.exports = { getHelpContent };
