#!/usr/bin/env node

import path from "path";
import { execSync } from "child_process";
import os from 'os';

import yargs from "yargs";
import simpleGit from 'simple-git';
import fs from "fs-extra";
import commandExists from "command-exists";

type Args = {
  dist: string;
  directory: string;
  repoUrl: string;
  branch: string;
  tempDir: string;
};

async function installDeps(path: string) {
  const currentCwd = process.cwd();
  process.chdir(path);
  
  // Check for different package managers in order of preference
  const packageManagers = ['yarn', 'bun', 'pnpm', 'npm'];
  let selectedManager = 'npm'; // default fallback

  for (const manager of packageManagers) {
    try {
      if (await commandExists(manager)) {
        selectedManager = manager;
        break;
      }
    } catch {
      continue;
    }
  }

  execSync(`${selectedManager} install`, { stdio: "inherit" });
  process.chdir(currentCwd);
}

async function main() {
  const { $0, _, ...parsedArgs } = yargs
    .scriptName("create-alliage-app")
    .command(
      "$0 <dist> <directory>",
      "Create an Alliage app from a given distribution",
      (builder: yargs.Argv) => {
        builder
          .positional("dist", {
            type: "string",
            describe: "The distribution to install",
          })
          .positional("directory", {
            type: "string",
            describe: "The project's directory",
          })
          .option("repoUrl", {
            type: "string",
            default: "https://github.com/alliage-framework/dists.git",
          })
          .option("branch", {
            type: "string",
            default: "main",
          })
          .option("tempDir", {
            type: "string",
            default: path.join(os.tmpdir(), 'create-alliage-app'),
          });
      }
    )
    .help().parseSync()

  const { dist, directory, repoUrl, branch, tempDir } = parsedArgs as Args;
  console.log(`⚙️  Installing "${dist}" distribution...`);

  // Remove temp directory where distributions are stored
  await fs.remove(tempDir);

  // Create temp directory
  await fs.ensureDir(tempDir);

  // Clone dists repository
  const git = simpleGit();
  await git.clone(repoUrl, tempDir, ['--branch', branch]);

  // Check if dist exists
  const distPath = path.resolve(tempDir, dist);
  if (!(await fs.pathExists(distPath))) {
    throw new Error(`${dist} does not exist.`);
  }

  // Copy dist in project's directory
  await fs.copy(distPath, directory);

  // Copy common files if they exists
  const commonDir = path.join(tempDir, '.common');
  if (fs.existsSync(commonDir)) {
    fs.copySync(commonDir, directory);
  }

  // Install dependencies
  await installDeps(directory);

  console.log(
    `✅ Your project has been successfully created in ${path.resolve(
      directory
    )}`
  );
}

try {
  main();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}