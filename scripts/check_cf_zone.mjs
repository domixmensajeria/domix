import fs from 'fs';
import https from 'https';

const toml = fs.readFileSync(process.env.APPDATA + '/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = toml.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!match) {
  console.log('No token found');
  process.exit(1);
}
const token = match[1];

function query(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
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
    }).on('error', reject);
  });
}

async function run() {
  console.log('Consultando zonas en Cloudflare...');
  const zones = await query('https://api.cloudflare.com/client/v4/zones');
  console.log('Total zonas encontradas:', zones.result?.length || 0);
  if (zones.result) {
    for (const z of zones.result) {
      console.log(`- Zona: ${z.name} | ID: ${z.id} | Status: ${z.status} | Name servers: ${z.name_servers?.join(', ')}`);
    }
  }

  const accountId = 'c48cf477f1a652898a3850f5eb7dcfcf';
  console.log('\nConsultando Workers en la cuenta ' + accountId + '...');
  const workers = await query(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`);
  if (workers.result && workers.result.length > 0) {
    console.log(`Total Workers encontrados: ${workers.result.length}`);
    for (const w of workers.result) {
      console.log(`- Worker: ${w.id} (modificado: ${w.modified_on})`);
    }
  } else {
    console.log('No hay Workers creados aún en esta cuenta.');
  }

  const sub = await query(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`);
  if (sub.result?.subdomain) {
    console.log(`\nSubdominio workers.dev de la cuenta: ${sub.result.subdomain}.workers.dev`);
  }
}

run().catch(console.error);
