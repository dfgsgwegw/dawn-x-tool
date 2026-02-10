import { getUncachableGitHubClient } from '../server/github';
import * as fs from 'fs';
import * as path from 'path';

const IGNORE_PATTERNS = [
  'node_modules', 'dist', '.DS_Store', 'server/public',
  '.replit', 'replit.md', '.cache', '.local', '.upm',
  'attached_assets', 'generated-icon.png', '.config',
  '.env', '.git', '*.log', '/tmp', '.vscode', '.idea',
  'package-lock.json', '*.tar.gz',
];

function shouldIgnore(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of IGNORE_PATTERNS) {
    const clean = pattern.replace(/^\//, '').replace(/\/$/, '');
    if (clean.startsWith('*.')) {
      const ext = clean.slice(1);
      if (normalized.endsWith(ext)) return true;
    } else {
      if (normalized === clean || normalized.startsWith(clean + '/') || normalized.includes('/' + clean + '/') || normalized.endsWith('/' + clean)) return true;
      const parts = normalized.split('/');
      if (parts.includes(clean)) return true;
    }
  }
  return false;
}

function collectFiles(dir: string, base: string = ''): { path: string; fullPath: string }[] {
  const results: { path: string; fullPath: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(relativePath)) continue;
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      results.push({ path: relativePath, fullPath });
    }
  }
  return results;
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.eot', '.pdf'];
  return binaryExtensions.some(ext => filePath.endsWith(ext));
}

async function main() {
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();

  console.log('Getting authenticated user...');
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  console.log(`Authenticated as: ${owner}`);

  const repo = 'dawn-x-tool';
  const description = 'Discord X Link Tracker - Track tweets shared in Discord channels with engagement metrics';

  console.log(`Ensuring repository exists: ${repo}...`);
  try {
    await octokit.repos.createForAuthenticatedUser({
      name: repo,
      description,
      auto_init: false,
      private: false,
    });
    console.log('Repository created.');
  } catch (error: any) {
    if (error.status === 422) {
      console.log('Repository already exists.');
    } else {
      throw error;
    }
  }

  let hasMainBranch = false;
  try {
    await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
    hasMainBranch = true;
    console.log('Main branch exists.');
  } catch {
    console.log('Main branch does not exist (empty repo). Initializing...');
  }

  if (!hasMainBranch) {
    console.log('Creating initial file to initialize repository...');
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '.gitkeep',
      message: 'Initialize repository',
      content: Buffer.from('').toString('base64'),
    });
    console.log('Repository initialized.');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('Collecting files...');
  const rootDir = process.cwd();
  const files = collectFiles(rootDir);
  console.log(`Found ${files.length} files to push.`);

  console.log('Getting current main branch ref...');
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' });
  const parentSha = ref.object.sha;

  console.log('Creating blobs...');
  const treeItems: any[] = [];
  
  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const blobPromises = batch.map(async (file) => {
      const isBinary = isBinaryFile(file.fullPath);
      let content: string;
      let encoding: 'utf-8' | 'base64';
      
      if (isBinary) {
        content = fs.readFileSync(file.fullPath).toString('base64');
        encoding = 'base64';
      } else {
        content = fs.readFileSync(file.fullPath, 'utf-8');
        encoding = 'utf-8';
      }

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding,
      });

      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    });

    const results = await Promise.all(blobPromises);
    treeItems.push(...results);
    console.log(`  Uploaded ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files`);
  }

  console.log('Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
  });

  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Initial commit: Dawn X Tool',
    tree: tree.sha,
    parents: [parentSha],
  });

  console.log('Updating main branch ref...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: commit.sha,
    force: true,
  });

  console.log(`\nDone! Repository available at: https://github.com/${owner}/${repo}`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
