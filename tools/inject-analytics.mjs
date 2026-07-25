/* Injects the Cloudflare Web Analytics beacon into the built page.
   Runs only in the GitHub Pages deploy workflow — local builds stay clean.
   The token is public by design (it ships in the page HTML). */
import { readFileSync, writeFileSync } from 'node:fs';

const token = process.env.CF_TOKEN || 'c84e8b2ba2ac4c1e96f620732047f207';
const path = 'dist/index.html';
const html = readFileSync(path, 'utf8');
if (!html.includes('</body>')) throw new Error('no </body> found in ' + path);
const snippet = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${token}"}'></script><!-- End Cloudflare Web Analytics -->`;
writeFileSync(path, html.replace('</body>', snippet + '\n</body>'));
console.log('Cloudflare Web Analytics beacon injected');
