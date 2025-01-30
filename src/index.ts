import {execSync} from "node:child_process";
import {existsSync} from "fs";
import * as path from "node:path";

type Settings = {
  dumpsLocation?: string;
  excludeTables?: string[];
  database: string;
}

export class DumpHook {
  public static readonly DEFAULT_SETTINGS = {
    dumpsLocation: "tmp/dump_hook",
    excludeTables: []
  };
  private readonly settings: Required<Settings>;

  constructor(settings: Settings) {
    this.settings = {...settings, ...DumpHook.DEFAULT_SETTINGS};
  }

  async execute(fileName: string, callback: () => Promise<void>) {
    if(!existsSync(this.settings.dumpsLocation)) await this.createCacheDir();

    const filePath = path.join(this.settings.dumpsLocation, `${fileName}.dump`);
    if(existsSync(filePath)) {
      await this.restore(filePath);
    } else {
      await callback();
      await this.dump(filePath);
    }
  }

  private async createCacheDir() {
    execSync(`mkdir -p ${this.settings.dumpsLocation}`)
  }

  private async dump(filePath: string) {
    const args: string[] = ["-d", this.settings.database, "-a", "-x", "-O", "-f", filePath, "-Fc"];
    for(const table of this.settings.excludeTables) {
      args.push("-T", table)
    }
    execSync(`pg_dump ${args.join(" ")}`)
  }

  private async restore(filePath: string) {
    execSync(`pg_restore -d ${this.settings.database} ${filePath}`)
  }
}
