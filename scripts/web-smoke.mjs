import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from 'playwright';

const port = Number(process.env.BOMR_WEB_SMOKE_PORT ?? '8088');
const host = process.env.BOMR_WEB_SMOKE_HOST ?? '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const startupTimeoutMs = 60_000;
const appTimeoutMs = 20_000;
const recentLogs = [];

function rememberLog(chunk) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    recentLogs.push(line);
    if (recentLogs.length > 120) {
      recentLogs.shift();
    }
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopServer(serverProcess) {
  if (serverProcess.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    serverProcess.kill('SIGINT');
  } else if (serverProcess.pid) {
    process.kill(-serverProcess.pid, 'SIGINT');
  }

  await Promise.race([
    new Promise((resolve) => serverProcess.once('exit', resolve)),
    delay(5_000),
  ]);

  if (serverProcess.exitCode === null) {
    if (process.platform === 'win32') {
      serverProcess.kill('SIGKILL');
    } else if (serverProcess.pid) {
      process.kill(-serverProcess.pid, 'SIGKILL');
    }
  }
}

async function assertNoBrowserErrors(pageErrors) {
  const actionableErrors = pageErrors.filter(
    (message) => !message.includes('Wake Lock permission request denied')
  );
  if (!actionableErrors.length) {
    return;
  }
  throw new Error(`Browser reported runtime errors:\n${actionableErrors.join('\n')}`);
}

const serverProcess = spawn(
  'npm',
  ['run', 'web', '--', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
      BROWSER: 'none',
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

serverProcess.stdout.on('data', rememberLog);
serverProcess.stderr.on('data', rememberLog);

let browser;

try {
  await waitForServer(baseUrl, startupTimeoutMs);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      pageErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(`${baseUrl}/calendar`, { timeout: appTimeoutMs });
  await page.waitForTimeout(1_000);

  await page.goto(`${baseUrl}/bom`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(`${baseUrl}/bom`, { timeout: appTimeoutMs });
  await page.waitForTimeout(500);

  await page.goto(`${baseUrl}/build`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(`${baseUrl}/build`, { timeout: appTimeoutMs });
  await page.waitForTimeout(500);

  await page.waitForTimeout(1_000);
  await assertNoBrowserErrors(pageErrors);
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  throw new Error(`${details}\n\nRecent server logs:\n${recentLogs.join('\n')}`);
} finally {
  await browser?.close();
  await stopServer(serverProcess);
}
