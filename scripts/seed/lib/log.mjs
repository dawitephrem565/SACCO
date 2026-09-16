/** Console output for the seed runner. Colours degrade to plain text when piped. */

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColour ? `\u001b[${code}m${s}\u001b[0m` : s);

const counters = { created: 0, skipped: 0, failed: 0 };

export const log = {
  section(name) {
    console.log(`\n${paint('1;36', `── ${name} `.padEnd(64, '─'))}`);
  },
  created(msg) {
    counters.created += 1;
    console.log(`  ${paint('32', '+')} ${msg}`);
  },
  skip(msg) {
    counters.skipped += 1;
    console.log(`  ${paint('90', '=')} ${paint('90', msg)}`);
  },
  info(msg) {
    console.log(`  ${paint('34', 'i')} ${msg}`);
  },
  warn(msg) {
    console.log(`  ${paint('33', '!')} ${msg}`);
  },
  error(msg) {
    counters.failed += 1;
    console.error(`  ${paint('31', 'x')} ${msg}`);
  },
  detail(msg) {
    console.error(`    ${paint('90', msg)}`);
  },
  summary() {
    console.log(`\n${paint('1;36', '─'.repeat(64))}`);
    console.log(
      `  ${paint('32', `${counters.created} created`)}   ` +
        `${paint('90', `${counters.skipped} already present`)}   ` +
        `${counters.failed ? paint('31', `${counters.failed} failed`) : '0 failed'}`
    );
    return counters;
  }
};
