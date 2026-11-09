const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ─── Config ───────────────────────────────────────────────────────────────────
const HRP = 'arg';
const WALLET_FILE = 'wallets.txt';
const WORKER_PATH = path.join(__dirname, 'miner-worker.js');
// ─────────────────────────────────────────────────────────────────────────────

function generateWallet() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH);

    worker.on('message', (msg) => {
      if (msg.type === 'ready') {
        worker.postMessage({ id: 1, type: 'newWallet', hrp: HRP });
      } else if (msg.id === 1 && msg.result) {
        worker.terminate();
        resolve(msg.result); // { mnemonic, address }
      } else if (msg.id === 1 && msg.error) {
        worker.terminate();
        reject(new Error(msg.error));
      }
    });

    worker.on('error', reject);
  });
}

function backupWallet(wallet) {
  const line = JSON.stringify(wallet) + '\n';
  fs.appendFileSync(WALLET_FILE, line);
}

async function doTasks(wallet) {
  // TODO: isi task di sini (register, claim, dsb)
  console.log(`[*] Running tasks for ${wallet.address}`);
}

async function runWallets(from, to) {
  const total = to - from + 1;
  for (let i = 0; i < total; i++) {
    const num = from + i;
    console.log(`\n[${num}] Generating wallet...`);
    const wallet = await generateWallet();
    console.log(`    Address : ${wallet.address}`);
    console.log(`    Mnemonic: ${wallet.mnemonic}`);
    backupWallet(wallet);
    await doTasks(wallet);
  }
  console.log('\n[✓] Done.');
}

function loadWallets() {
  if (!fs.existsSync(WALLET_FILE)) return [];
  return fs.readFileSync(WALLET_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
}

function prompt(rl, q) {
  return new Promise(res => rl.question(q, res));
}

async function runTasks(wallets, label) {
  console.log(`\n[*] Menjalankan task untuk ${wallets.length} wallet (${label})...\n`);
  for (let i = 0; i < wallets.length; i++) {
    console.log(`[${i + 1}/${wallets.length}] ${wallets[i].address}`);
    await doTasks(wallets[i]);
  }
  console.log('\n[✓] Done.');
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=== Argonmine ===');
  console.log('1. 1 akun');
  console.log('2. Semua akun');
  console.log('3. From X to end');
  console.log('4. Create new akun');

  const choice = (await prompt(rl, '\nPilih [1/2/3/4]: ')).trim();

  if (choice === '1') {
    const num = parseInt(await prompt(rl, 'Nomor akun (misal 1): '));
    rl.close();
    const wallets = loadWallets();
    const idx = num - 1;
    if (isNaN(num) || !wallets[idx]) {
      console.log('[!] Akun tidak ditemukan.');
      return;
    }
    console.log(`\n[*] Akun #${num}: ${wallets[idx].address}`);
    await doTasks(wallets[idx]);
    console.log('\n[✓] Done.');

  } else if (choice === '2') {
    rl.close();
    const wallets = loadWallets();
    if (wallets.length === 0) {
      console.log('[!] Belum ada wallet di wallets.txt');
      return;
    }
    await runTasks(wallets, 'semua');

  } else if (choice === '3') {
    const from = parseInt(await prompt(rl, 'Dari nomor berapa: '));
    rl.close();
    const wallets = loadWallets();
    if (isNaN(from) || from < 1) {
      console.log('[!] Input tidak valid.');
      return;
    }
    const slice = wallets.slice(from - 1);
    if (slice.length === 0) {
      console.log('[!] Tidak ada akun dari nomor tersebut.');
      return;
    }
    await runTasks(slice, `#${from} sampai #${wallets.length}`);

  } else if (choice === '4') {
    const jumlah = parseInt(await prompt(rl, 'Berapa akun baru: '));
    rl.close();
    if (isNaN(jumlah) || jumlah < 1) {
      console.log('[!] Input tidak valid.');
      return;
    }
    const existing = loadWallets().length;
    for (let i = 0; i < jumlah; i++) {
      const num = existing + i + 1;
      console.log(`\n[${num}] Generating wallet...`);
      const wallet = await generateWallet();
      console.log(`    Address : ${wallet.address}`);
      console.log(`    Mnemonic: ${wallet.mnemonic}`);
      backupWallet(wallet);
      await doTasks(wallet);
    }
    console.log('\n[✓] Done.');

  } else {
    rl.close();
    console.log('[!] Pilihan tidak valid.');
  }
}

main().catch(console.error);
