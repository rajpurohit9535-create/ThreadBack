import path from 'path';
import fs from 'fs';

export default function setup() {
  const testDbDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbPath = path.resolve(testDbDir, 'test-suite.db');
  const walPath = `${testDbPath}-wal`;
  const shmPath = `${testDbPath}-shm`;

  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }
  if (fs.existsSync(walPath)) {
    try { fs.unlinkSync(walPath); } catch {}
  }
  if (fs.existsSync(shmPath)) {
    try { fs.unlinkSync(shmPath); } catch {}
  }
}
