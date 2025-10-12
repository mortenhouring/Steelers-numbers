// run-scripts.js
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Timestamp for log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = path.resolve('logs');
const logFile = path.join(logDir, `run-${timestamp}.log`);

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create write stream for log file
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const scripts = [
  'fetch/fetch-steelers.js',
  'fetchimages/images-fetch-steelers.js',
  'fetchimages/trivia.js',
  'fetchimages/depth.js',
  'fetchimages/write-to-root-current.js',
  'fetchimages/write-depth-to-root.js'
];

async function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔹 Running: ${script}`);
    logStream.write(`\n🔹 Running: ${script}\n`);

    const proc = spawn('node', [script]);

    proc.stdout.on('data', data => {
      process.stdout.write(data);       // show live in console
      logStream.write(data);            // write to log file
    });

    proc.stderr.on('data', data => {
      process.stderr.write(data);       // show live in console
      logStream.write(data);            // write to log file
    });

    proc.on('close', code => {
      const msg = `✅ Finished: ${script} (exit code ${code})\n`;
      console.log(msg);
      logStream.write(msg);

      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function runAll() {
  console.log(`🚀 Starting sequential script run... Logs will be saved to ${logFile}`);
  logStream.write(`🚀 Starting sequential script run at ${new Date().toISOString()}\n`);

  try {
    for (const script of scripts) {
      await runScript(script);
    }
    const doneMsg = '\n🎉 All scripts finished successfully!\n';
    console.log(doneMsg);
    logStream.write(doneMsg);
    logStream.end();
  } catch (err) {
    const errMsg = `\n❌ Script failed: ${err.message}\n`;
    console.error(errMsg);
    logStream.write(errMsg);
    logStream.end();
    process.exit(1);
  }
}

runAll();