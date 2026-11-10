#!/usr/bin/env node
/**
 * Recette de l'interface Numivo avec Chrome headless + Playwright.
 * Pré-requis : API sur :4000, front sur :3000, Playwright disponible.
 * Usage : node scripts/ui-check.cjs [url_frontend]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const candidates = [];
    try {
      const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
      candidates.push(path.join(root, 'playwright'));
    } catch {
      /* ignore */
    }
    try {
      const found = execSync(
        'find "$HOME/.npm/_npx" -maxdepth 4 -type d -name playwright 2>/dev/null || true',
        { encoding: 'utf8' },
      );
      candidates.push(...found.split('\n').filter(Boolean));
    } catch {
      /* ignore */
    }
    for (const candidate of candidates) {
      try {
        return require(candidate);
      } catch {
        /* continue */
      }
    }
    throw new Error('Playwright introuvable : npm i -g playwright (ou npx playwright).');
  }
}

const { chromium } = loadPlaywright();

function readAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envFile = path.resolve(__dirname, '..', '.env');
  const line = fs
    .readFileSync(envFile, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith('ADMIN_PASSWORD='));
  if (!line) throw new Error('ADMIN_PASSWORD absent du .env');
  return line.slice('ADMIN_PASSWORD='.length).trim();
}

const results = [];
const log = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
  const front = process.argv[2] ?? 'http://localhost:3000';
  const adminPassword = readAdminPassword();
  const browser = await chromium
    .launch({ channel: 'chrome', headless: true })
    .catch(() => chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const httpErrors = [];
  let loggingOut = false;
  page.on('dialog', (dialog) => void dialog.accept());
  page.on('pageerror', (error) => httpErrors.push(`[js] ${error.message}`));
  page.on('response', (response) => {
    // 401 sur /auth/refresh est normal sans session ; 404 favicon ignoré.
    // Une requête déjà en vol au moment de la déconnexion peut aussi renvoyer
    // 401 : c'est attendu, le frontend purge la session.
    if (response.status() === 401 && loggingOut) return;
    if (response.status() >= 400 && !response.url().includes('/auth/refresh')) {
      httpErrors.push(`[${response.status()}] ${response.url()}`);
    }
  });

  const login = async (email, password) => {
    await page.getByRole('button', { name: /connexion/i }).first().click();
    await page.waitForTimeout(400);
    await page.getByPlaceholder('client@numivo.local').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForTimeout(2500);
  };

  const logout = async () => {
    const button = page.getByRole('button', { name: /déconnexion/i }).first();
    if (await button.count()) {
      loggingOut = true;
      await button.click();
      await page.waitForTimeout(1500);
      loggingOut = false;
    }
  };

  // ---------- Visiteur ----------
  await page.goto(front, { waitUntil: 'networkidle' });
  log('page publique chargée', (await page.title()).includes('Numivo'), await page.title());
  log('catalogue alimenté par l’API', (await page.getByRole('button', { name: /^acheter$/i }).count()) > 10);

  // ---------- Inscription ----------
  const newEmail = `ui.compte.${Date.now()}@numivo.local`;
  await page.getByRole('button', { name: /connexion/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^inscription$/i }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('Jean Dupont').fill('Compte UI');
  await page.getByPlaceholder('jean.dupont@email.com').fill(newEmail);
  await page.getByPlaceholder('+229 97 00 11 22').fill('+229 97000000');
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('MotDePasseTest123');
  await passwordInputs.nth(1).fill('MotDePasseTest123');
  await page.locator('input[type="checkbox"]').last().check();
  await page.getByRole('button', { name: /créer mon compte client/i }).click();
  await page.waitForTimeout(3000);
  const registered = await page.locator('body').innerText();
  log('inscription depuis l’interface', /Mes Numéros & SMS en Direct/.test(registered), newEmail);
  log('portefeuille du nouveau compte', /Solde Portefeuille \(XOF\)/.test(registered));
  await logout();

  // ---------- Client ----------
  await login('client@numivo.local', 'demo123456');
  const dash = await page.locator('body').innerText();
  log('portail client', /Mes Numéros & SMS en Direct/.test(dash));
  log('solde portefeuille XOF', /Solde Portefeuille \(XOF\)/.test(dash));

  await page.getByRole('button', { name: /^catalogue$/i }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^acheter$/i }).first().click();
  await page.waitForTimeout(1500);
  const modalText = await page.locator('body').innerText();
  log('devis calculé côté serveur', /Prix calculé côté serveur/.test(modalText));
  log('moyens de paiement proposés', ['Mobile Money', 'Carte Bancaire', 'Portefeuille'].every((item) => modalText.includes(item)));
  await page.getByRole('button', { name: /^fermer$/i }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: /mon espace/i }).first().click();
  await page.waitForTimeout(1500);
  await page.getByText('Recharger Portefeuille', { exact: false }).first().click();
  await page.waitForTimeout(1000);
  const deposit = page.getByRole('dialog').first();
  log('modal de recharge accessible', (await deposit.count()) > 0);
  const depositText = await deposit.innerText();
  log('recharge FedaPay en XOF', /FedaPay/.test(depositText) && /XOF/.test(depositText));
  const amountInput = deposit.locator('input[type="number"]').first();
  log('bornes de recharge', (await amountInput.getAttribute('min')) === '500' && (await amountInput.getAttribute('max')) === '1000000');
  await deposit.getByRole('button', { name: /^annuler$/i }).first().click();

  await logout();

  // ---------- Admin ----------
  await login('admin@numivo.local', adminPassword);
  const admin = await page.locator('body').innerText();
  log('console admin', /Supervision Numivo/.test(admin));
  log('ségrégation des fonds clients', /Fonds clients cloisonnés/i.test(admin));

  const tabs = ['Commandes', 'Catalogue & Coûts', 'Utilisateurs', 'Règles de Prix', 'Fournisseur Ultra SMS', "Journal d'Audit"];
  for (const tab of tabs) {
    const button = page.getByRole('button', { name: new RegExp(`^${tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }).first();
    if ((await button.count()) === 0) {
      log(`onglet ${tab}`, false, 'introuvable');
      continue;
    }
    await button.click();
    await page.waitForTimeout(700);
    log(`onglet ${tab}`, (await page.locator('body').innerText()).length > 500);
  }

  log('clé API non exposée', !/sk_[A-Za-z0-9]{12,}/.test(await page.locator('body').innerText()));

  // ---------- Réinitialisation d'un mot de passe ----------
  await page.getByRole('button', { name: /^Utilisateurs/ }).first().click();
  await page.waitForTimeout(1200);
  const userRow = page.locator('tr', { hasText: newEmail }).first();
  log('compte créé visible dans la console', (await userRow.count()) === 1);
  if (await userRow.count()) {
    await userRow.getByRole('button', { name: /^Réinitialiser$/i }).click();
    await page.waitForTimeout(1800);
    const status = page.locator('[role="status"]', { hasText: 'Mot de passe temporaire pour' }).first();
    const statusText = (await status.count()) ? await status.innerText() : '';
    log('mot de passe temporaire affiché', /Mot de passe temporaire pour/.test(statusText), statusText.split('\n')[0]);
    const temporary = (await status.count())
      ? await status.locator('code').first().innerText()
      : '';
    log('mot de passe temporaire non vide', temporary.trim().length >= 12);
  }

  await browser.close();

  const failures = results.filter((entry) => !entry.ok).length;
  if (httpErrors.length) {
    console.log('\nErreurs réseau/JS inattendues :');
    for (const message of [...new Set(httpErrors)]) console.log('  ', message);
  }
  console.log(`\nRésultat : ${results.length - failures} réussis, ${failures} échoués`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((error) => {
  console.error('ECHEC :', error);
  process.exit(1);
});
