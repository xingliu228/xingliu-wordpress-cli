const chalk = require('chalk');

function table(headers, rows) {
  const widths = headers.map((h, i) => {
    const max = rows.reduce((m, r) => Math.max(m, String(r[i] || '').length), String(h).length);
    return max + 2;
  });

  const sep = '─'.repeat(widths.reduce((a, b) => a + b, 0) + widths.length * 3 + 1);
  let out = '';

  out += chalk.bold(
    '  ' + headers.map((h, i) => h.padEnd(widths[i])).join(' │ ') + '\n'
  );
  out += '  ' + sep + '\n';

  for (const row of rows) {
    out += '  ' + row.map((cell, i) => {
      const s = String(cell || '');
      return s.padEnd(widths[i]);
    }).join(' │ ') + '\n';
  }
  return out;
}

function list(headers, rows) {
  let out = '';
  for (const row of rows) {
    out += headers.map((h, i) => `${h}: ${row[i] || '-'}`).join('\n') + '\n\n';
  }
  return out.trimEnd() + '\n';
}

function success(msg) {
  console.log(chalk.green('✓ ') + msg);
}

function error(msg) {
  console.error(chalk.red('✗ ') + msg);
}

function info(msg) {
  console.log(chalk.cyan('ℹ ') + msg);
}

function warn(msg) {
  console.log(chalk.yellow('⚠ ') + msg);
}

function json(data) {
  console.log(JSON.stringify(data, null, 2));
}

function formatDate(d) {
  if (!d) return '-';
  return d.replace('T', ' ').substring(0, 19);
}

function statusColor(status) {
  switch (status) {
    case 'publish': return chalk.green(status);
    case 'draft': return chalk.yellow(status);
    case 'pending': return chalk.blue(status);
    case 'trash': return chalk.red(status);
    case 'private': return chalk.magenta(status);
    default: return status;
  }
}

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").trim();
}

module.exports = { table, list, success, error, info, warn, json, formatDate, statusColor, stripHtml };
