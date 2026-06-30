const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.xingliu-wp');
const PROFILES_FILE = path.join(CONFIG_DIR, 'profiles.json');
const ACTIVE_FILE = path.join(CONFIG_DIR, 'active');

const JWT_ROUTES = [
  '/jwt-auth/v1/token',
  '/simple-jwt-login/v1/token',
];

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// === Profiles ===

function readProfiles() {
  ensureDir();
  if (!fs.existsSync(PROFILES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeProfiles(profiles) {
  ensureDir();
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
}

function getActiveProfile() {
  ensureDir();
  if (!fs.existsSync(ACTIVE_FILE)) return null;
  const name = fs.readFileSync(ACTIVE_FILE, 'utf-8').trim();
  if (!name) return null;
  const profiles = readProfiles();
  return profiles.find(p => p.name === name) || null;
}

function setActiveProfile(name) {
  ensureDir();
  fs.writeFileSync(ACTIVE_FILE, name, 'utf-8');
}

function saveProfile(profile) {
  const profiles = readProfiles();
  const idx = profiles.findIndex(p => p.name === profile.name);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile };
  } else {
    profiles.push(profile);
  }
  writeProfiles(profiles);
}

function deleteProfile(name) {
  const profiles = readProfiles().filter(p => p.name !== name);
  writeProfiles(profiles);
  // clear active if it was the deleted one
  const active = getActiveProfile();
  if (active && active.name === name) {
    try { fs.unlinkSync(ACTIVE_FILE); } catch {}
  }
}

// === Token helpers ===

function getToken() {
  const profile = getActiveProfile();
  if (!profile || !profile.token) return { token: null, site: null, profile: null };
  if (profile.tokenExpiry && Date.now() > profile.tokenExpiry - 3600000) {
    return { token: null, site: profile.site, profile: profile.name };
  }
  return { token: profile.token, site: profile.site, profile: profile.name };
}

function setToken(profileName, token, expiry) {
  const profiles = readProfiles();
  const p = profiles.find(p => p.name === profileName);
  if (p) {
    p.token = token;
    p.tokenExpiry = expiry || (Date.now() + 7 * 24 * 60 * 60 * 1000);
    writeProfiles(profiles);
  }
}

// === JWT route auto-discovery ===

async function detectJwtRoute(site) {
  const normalizedSite = site.replace(/\/+$/, '');
  for (const r of JWT_ROUTES) {
    return `${normalizedSite}/wp-json${r}`;
  }
  return `${normalizedSite}/wp-json/jwt-auth/v1/token`;
}

// === Public API ===

module.exports = {
  readProfiles,
  getActiveProfile,
  setActiveProfile,
  saveProfile,
  deleteProfile,
  getToken,
  setToken,
  detectJwtRoute,
  configDir: () => CONFIG_DIR,
  profilesFile: () => PROFILES_FILE,
};
