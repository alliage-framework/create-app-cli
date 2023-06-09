#!/usr/bin/env node

import path from "path";
import { execSync } from "child_process";

import yargs from "yargs";
import { Clone } from "nodegit";
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
  const command = (await commandExists("yarn")) ? "yarn" : "npm";
  execSync(`${command} install`, { stdio: "inherit" });
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
            default: "/tmp/create-alliage-app",
          });
      }
    )
    .help().parseSync()

  const { dist, directory, repoUrl, branch, tempDir } = parsedArgs as Args;
  console.log(`⚙️  Installing "${dist}" distribution...`);

  // Remove temp directory where distributions are stored
  await fs.remove(tempDir);

  // Clone dists repository
  // @ts-ignore
  const repo = await Clone.clone(repoUrl, tempDir, { checkoutBranch: branch });

  // Check if dist exists
  const distPath = path.resolve(repo.workdir(), dist);
  if (!(await fs.pathExists(distPath))) {
    throw new Error(`${dist} does not exist.`);
  }

  // Copy dist in project's directory
  await fs.copy(distPath, directory);

  // Copy common files if they exists
  const commonDir = `${repo.workdir()}/.common`;
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