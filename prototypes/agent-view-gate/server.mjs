// PROTOTYPE server for gate G2. Serves the test page, and records what the bank actually receives at /pay.
// Run: node server.mjs   (then open http://localhost:5299). Received forms go to received.jsonl.
import { createServer } from 'node:http';
import { readFileSync, appendFileSync } from 'node:fs';

const STATEMENT = `<!doctype html><meta charset="utf-8"><script src="/vault.js"></script><script src="/rewrite.js"></script>
<body style="font:13px system-ui;margin:6px">iframe: statement for Marcus Ellery, 4127 Lindell Road, account 004417829915</body>`;

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/pay') {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => {
      const form = Object.fromEntries(new URLSearchParams(body));
      appendFileSync('received.jsonl', JSON.stringify({ at: new Date().toISOString(), form }) + '\n');
      console.log('BANK RECEIVED', form);
      res.writeHead(200, { 'content-type': 'text/html' });
      // A real bank echoes the real account number on the confirmation page. The rewrite must hide it again.
      res.end(`<!doctype html><meta charset="utf-8"><title>Payment sent</title><script src="/vault.js"></script><script src="/rewrite.js"></script>
<body style="font:15px system-ui;margin:24px"><h2>Payment sent</h2><p>Paid $${form.amount} to ${form.payee} from account ${form.from_account}.</p>
<p>Confirmation emailed to marcus.ellery@example.com</p><p><a href="/">Back</a></p></body>`);
    });
    return;
  }
  const file = { '/': 'index.html', '/vault.js': 'vault.js', '/rewrite.js': 'rewrite.js' }[url.pathname];
  if (url.pathname === '/statement.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(STATEMENT); }
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' });
  res.end(readFileSync(file));
}).listen(5299, () => console.log('gate server on http://localhost:5299'));
