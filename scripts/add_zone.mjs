import fs from 'fs';
import https from 'https';

const toml = fs.readFileSync(process.env.APPDATA + '/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!match) {
  console.log('No token found');
  process.exit(1);
}
const token = match[1];
const accountId = 'c48cf477f1a652898a3850f5eb7dcfcf';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        'User-Agent': 'wrangler/4'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

async function addZone() {
  console.log('Intentando registrar turafood.com en Cloudflare...');
  const res = await post('https://api.cloudflare.com/client/v4/zones', {
    account: { id: accountId },
    name: 'turafood.com',
    type: 'full'
  });
  console.log('Respuesta:', JSON.stringify(res, null, 2));
}

addZone().catch(console.error);
