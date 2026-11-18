const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const htmlFiles = fs.readdirSync(SCREENSHOTS_DIR).filter((f) => f.endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const pngFile = htmlFile.replace(".html", ".png");
    const filePath = path.join(SCREENSHOTS_DIR, htmlFile);
    const outPath = path.join(SCREENSHOTS_DIR, pngFile);

    console.log(`Screenshotting: ${htmlFile} -> ${pngFile}`);
    try {
      execSync(
        `"${CHROME_PATH}" --headless=new --disable-gpu --user-data-dir="/tmp/chrome-profile-${Date.now()}" --screenshot="${outPath}" --window-size=800,650 "file://${filePath}"`,
        { stdio: "ignore" }
      );
      console.log(`  -> Saved ${pngFile}`);
    } catch (e) {
      console.error(`  -> Failed for ${htmlFile}:`, e.message);
    }
  }
  console.log("\nAll screenshots processed!");
}

main().catch(console.error);
