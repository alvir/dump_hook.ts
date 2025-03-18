import { execSync } from "node:child_process";
import { existsSync, rmSync } from "fs";
import * as path from "node:path";

type Settings = {
  dumpsLocation?: string;
  excludeTables?: string[];
  schemas?: string[];
  recreate?: boolean;
  database: string;
};

export class DumpHook {
  private recreatedDumps: string[] = [];

  public static readonly DEFAULT_SETTINGS = {
    dumpsLocation: "tmp/dump_hook",
    schemas: ["public"],
    excludeTables: [],
    recreate: false
  };
  private readonly settings: Required<Settings>;

  constructor(settings: Settings) {
    if (settings.recreate === undefined) {
      settings.recreate = process.env.DUMP_HOOK === "recreate";
    }
    this.settings = { ...DumpHook.DEFAULT_SETTINGS, ...settings };
  }

  async execute(fileName: string, callback: () => Promise<void>) {
    if (!existsSync(this.settings.dumpsLocation)) await this.createCacheDir();

    const filePath = path.join(this.settings.dumpsLocation, `${fileName}.dump`);
    if (this.toRecreate(filePath)) {
      rmSync(filePath, {});
      this.recreatedDumps.push(filePath);
    }

    if (existsSync(filePath)) {
      await this.restore(filePath);
    } else {
      await callback();
      await this.dump(filePath);
    }
  }

  private async createCacheDir() {
    execSync(`mkdir -p ${this.settings.dumpsLocation}`);
  }

  private async dump(filePath: string) {
    const args: string[] = [
      "-d",
      this.settings.database,
      "-a",
      "-x",
      "-O",
      "-f",
      filePath,
      "-Fc"
    ];
    for (const table of this.settings.excludeTables) {
      args.push("-T", table);
    }
    for (const schema of this.settings.schemas) {
      args.push("-n", schema);
    }
    execSync(`pg_dump ${args.join(" ")}`);
  }

  private async restore(filePath: string) {
    execSync(`pg_restore -d ${this.settings.database} ${filePath}`);
  }

  private toRecreate(filePath: string) {
    return this.settings.recreate && !this.recreatedDumps.includes(filePath);
  }
}
