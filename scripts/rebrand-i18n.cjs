#!/usr/bin/env node
/* eslint-disable */
// Rebrand frontend i18n: replace user-visible "Mifos*" with "Dantel".
// Skips the labels.licensing.* and labels.aboutUs.* blocks (OSS attribution
// about the upstream Mifos project — must remain factually accurate).
// One-shot tool; safe to delete after the rebrand commit lands.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'frontend', 'src', 'assets', 'translations');

// Anchored on `: "..."` to avoid touching KEY text (translate-pipe key lookups
// rely on key strings staying byte-identical).
const PATTERNS = [
  [/: "Mifos® X WebApp"/g, ': "Dantel"'],
  [/: "Mifos® WebApp"/g, ': "Dantel"'],
  [/: "Mifos Reporting Plugin for Eclipse Birt"/g, ': "Dantel Reporting Plugin for Eclipse Birt"'],
  [/: "Mifos Reporting Plugin for Pentaho"/g, ': "Dantel Reporting Plugin for Pentaho"'],
  [/: "Assign to Mifos Client"/g, ': "Assign to Dantel Client"'],
  [/: "Search and assign this beneficiary to an existing Mifos client account"/g,
   ': "Search and assign this beneficiary to an existing Dantel client account"'],
  // value-side phrases (these don't appear in keys, so global is fine outside the
  // protected blocks):
  [/Welcome to Mifos®/g, 'Welcome to Dantel'],
  [/Mifos® Initiative/g, 'Dantel'],
  [/Mifos® system/g, 'Dantel system'],
  [/Mifos®/g, 'Dantel'],
  [/Mifos X data-tables/g, 'Dantel data-tables'],
  [/Mifos X Accounting/g, 'Dantel'],
  [/Mifos X system/g, 'Dantel'],
  [/Mifos X,/g, 'Dantel,'],
  [/Mifos X\./g, 'Dantel.'],
  [/in Mifos X/g, 'in Dantel'],
  [/pages in Mifos X/g, 'pages in Dantel'],
  [/Mifos Intelligence AI/g, 'Dantel Intelligence AI'],
  [/Mifos supports two types/g, 'Dantel supports two types']
];

let totalChanges = 0;
const perFile = {};

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const fp = path.join(dir, f);
  const text = fs.readFileSync(fp, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  let skipping = false; // inside labels.licensing or labels.aboutUs subtree
  let fileChanges = 0;
  const out = [];

  for (const line of lines) {
    if (!skipping) {
      if (/^\s{4}"(licensing|aboutUs)":\s*\{/.test(line)) {
        skipping = true;
        out.push(line);
        continue;
      }
      let next = line;
      for (const [re, rep] of PATTERNS) {
        const before = next;
        next = next.replace(re, rep);
        if (next !== before) fileChanges++;
      }
      out.push(next);
    } else {
      out.push(line);
      if (/^\s{4}\},?\s*$/.test(line)) {
        skipping = false;
      }
    }
  }

  if (fileChanges > 0) {
    fs.writeFileSync(fp, out.join(eol));
    perFile[f] = fileChanges;
    totalChanges += fileChanges;
  }
}

console.log(`Rebrand: ${totalChanges} substitutions across ${Object.keys(perFile).length} files`);
for (const [f, n] of Object.entries(perFile).sort()) {
  console.log(`  ${f}: ${n}`);
}
