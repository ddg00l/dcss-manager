/* Injects the Cloudflare Web Analytics beacon into the built page.
   Runs only in the GitHub Pages deploy workflow — local builds stay clean. */
import { readFileSync, writeFileSync } from 'node:fs';

const token = process.env.CF_TOKEN;
if (!token) {
  console.log('CF_TOKEN is not set — skipping analytics injection');
  process.exit(0);
}
const path = 'dist/index.html';
const html = readFileSync(path, 'utf8');
if (!html.includes('</body>')) throw new Error('no </body> found in ' + path);
const snippet = `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>`;
writeFileSync(path, html.replace('</body>', snippet + '\n</body>'));
console.log('Cloudflare Web Analytics beacon injected');
