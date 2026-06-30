const https = require('https');
const http = require('http');
const url = require('url');

function request(method, fullUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(fullUrl);
    const mod = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...opts.headers,
    };

    if (opts.token) {
      // Support both JWT Bearer and Application Password Basic
      if (opts.token.startsWith('Basic ')) {
        headers['Authorization'] = opts.token;
      } else {
        headers['Authorization'] = `Bearer ${opts.token}`;
      }
    }

    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method,
      headers,
    };

    const req = mod.request(reqOpts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch { data = body; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (opts.body) {
      if (Buffer.isBuffer(opts.body)) {
        headers['Content-Type'] = 'application/octet-stream';
        req.write(opts.body);
      } else {
        req.write(JSON.stringify(opts.body));
      }
    }
    req.end();
  });
}

class WPClient {
  constructor(site, token = null) {
    this.site = site.replace(/\/+$/, '');
    this.token = token;
  }

  api(path) {
    return `${this.site}/wp-json${path}`;
  }

  async get(path, qs = {}) {
    const q = new URLSearchParams(qs).toString();
    const u = q ? `${this.api(path)}?${q}` : this.api(path);
    return request('GET', u, { token: this.token });
  }

  async post(path, body = {}, qs = {}) {
    const q = new URLSearchParams(qs).toString();
    const u = q ? `${this.api(path)}?${q}` : this.api(path);
    return request('POST', u, { token: this.token, body });
  }

  async put(path, body = {}) {
    return request('PUT', this.api(path), { token: this.token, body });
  }

  async delete(path, qs = {}) {
    const q = new URLSearchParams(qs).toString();
    const u = q ? `${this.api(path)}?${q}` : this.api(path);
    return request('DELETE', u, { token: this.token });
  }

  async upload(path, filePath, fs) {
    const fileName = filePath.split('/').pop().split('\\').pop();
    const fileBuffer = fs.readFileSync(filePath);
    return request('POST', this.api(path), {
      token: this.token,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
      body: fileBuffer,
    });
  }

  // Auth
  async login(jwtRoute, username, password) {
    return request('POST', `${this.site}/wp-json${jwtRoute}`, {
      body: { username, password },
    });
  }
}

module.exports = { WPClient, request };
