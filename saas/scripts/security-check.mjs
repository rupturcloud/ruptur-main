#!/usr/bin/env node
/**
 * SECURITY CHECK — Ruptur SaaS
 *
 * Detecta credenciais expostas em arquivos versionados
 * Uso: node scripts/security-check.mjs
 *
 * Exit codes:
 * 0 = OK (sem problemas)
 * 1 = ⚠️  EXPOSIÇÕES ENCONTRADAS (revisar)
 * 2 = ❌ CRÍTICO (não fazer deploy)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const RISK_PATTERNS = {
  HIGH: [
    { pattern: /(?:supabaseKey|SUPABASE_ANON_KEY)\s*[:=]\s*['"]eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+['"]?/g, name: 'Supabase/JWT hardcoded' },
    { pattern: /(?:adminToken|UAZAPI_ADMIN_TOKEN)\s*[:=]\s*['"][A-Za-z0-9_\-./+=]{24,}['"]?/g, name: 'UAZAPI Admin Token hardcoded' },
    { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, name: 'JWT Token (generic)' },
    { pattern: /-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----/g, name: 'Private SSH Key' },
  ],
  MEDIUM: [
    { pattern: /(?:API_KEY|SECRET|PASSWORD)\s*[:=]\s*['"][A-Za-z0-9_\-./+=]{24,}['"]?/g, name: 'Possible secret literal' },
  ],
};

const SAFE_PATTERNS = {
  placeholder: /SET_YOUR_|xxx|fake|demo|test_key|process\.env/i,
};

const FILES_TO_CHECK = [
  'runtime-data/warmup-state.json',
  'modules/warmup-core/server.mjs',
  'api/gateway.mjs',
  'jest.config.js',
  'package.json',
];

const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'web/manager-dist',
  'web/dashboard-dist',
  'dist',
  '.next',
];

function isPlaceholder(content) {
  return SAFE_PATTERNS.placeholder.test(content);
}

function checkFile(filePath) {
  const findings = { HIGH: [], MEDIUM: [] };

  if (!existsSync(filePath)) {
    return findings;
  }

  try {
    const content = readFileSync(filePath, 'utf8');

    for (const [level, patterns] of Object.entries(RISK_PATTERNS)) {
      for (const { pattern, name } of patterns) {
        const matches = content.matchAll(new RegExp(pattern, 'gm'));
        for (const match of matches) {
          if (!isPlaceholder(match[0])) {
            findings[level].push({
              file: filePath,
              pattern: name,
              context: match[0].substring(0, 60) + '...',
            });
          }
        }
      }
    }
  } catch (err) {
    // ignore binary files
  }

  return findings;
}

function checkGitHistory() {
  const HIGH_RISK_FILES = ['runtime-data/warmup-state.json'];
  const findings = [];

  for (const file of HIGH_RISK_FILES) {
    try {
      const history = execSync(`git log --all --full-history --oneline -- ${file}`, {
        encoding: 'utf8',
      }).trim();

      if (history) {
        findings.push({
          file,
          reason: `File tracked in git history (${history.split('\n').length} commits)`,
          action: 'Run: git filter-branch --force --index-filter "git rm --cached --ignore-unmatch runtime-data/warmup-state.json" --prune-empty HEAD',
        });
      }
    } catch (err) {
      // file not in git, OK
    }
  }

  return findings;
}

function run() {
  console.log('\n🔐 RUPTUR SECURITY CHECK\n');

  let allFindings = { HIGH: [], MEDIUM: [] };
  const gitIssues = [];

  // Check individual files
  console.log('Checking files for exposed credentials...');
  for (const file of FILES_TO_CHECK) {
    const findings = checkFile(file);
    allFindings.HIGH.push(...findings.HIGH);
    allFindings.MEDIUM.push(...findings.MEDIUM);
  }

  // Check git history
  console.log('Checking git history for tracked secrets...');
  const gitHistoryIssues = checkGitHistory();
  gitIssues.push(...gitHistoryIssues);

  // Report
  console.log('\n' + '='.repeat(60));

  if (allFindings.HIGH.length === 0 && allFindings.MEDIUM.length === 0 && gitIssues.length === 0) {
    console.log('✅ No exposed credentials found\n');
    return 0;
  }

  if (allFindings.HIGH.length > 0) {
    console.log(`\n🚨 HIGH RISK FINDINGS (${allFindings.HIGH.length})`);
    for (const finding of allFindings.HIGH) {
      console.log(`   ${finding.file}: ${finding.pattern}`);
      console.log(`   └─ ${finding.context}`);
    }
  }

  if (allFindings.MEDIUM.length > 0) {
    console.log(`\n⚠️  MEDIUM RISK FINDINGS (${allFindings.MEDIUM.length})`);
    for (const finding of allFindings.MEDIUM) {
      console.log(`   ${finding.file}: ${finding.pattern}`);
    }
  }

  if (gitIssues.length > 0) {
    console.log(`\n📜 GIT HISTORY WARNINGS (${gitIssues.length})`);
    for (const issue of gitIssues) {
      console.log(`   ${issue.file}`);
      console.log(`   └─ ${issue.reason}`);
      console.log(`   └─ FIX opcional/planejado: ${issue.action}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('\n📋 REMEDIATION STEPS:\n');
  console.log('1. Move exposed tokens from .json files to .env');
  console.log('2. Add files to .gitignore');
  console.log('3. Rotate all exposed credentials immediately');
  console.log('4. If in git history, run: git filter-branch');
  console.log('5. Force push with: git push --force-with-lease');

  const strictHistory = process.env.STRICT_GIT_HISTORY === '1';
  const exitCode = allFindings.HIGH.length > 0 ? 2 : (allFindings.MEDIUM.length > 0 ? 1 : (strictHistory && gitIssues.length > 0 ? 1 : 0));
  console.log(`\nExit code: ${exitCode}\n`);
  return exitCode;
}

process.exit(run());
