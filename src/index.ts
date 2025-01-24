import {exec} from "node:child_process";
import {existsSync} from "fs";
import * as path from "node:path";

const settings = {
  cacheDir: "tmp/dump_hook",
  excludeTables: ["_prisma_migrations"],
  database: process.env.DATABASE_URL!
};

export class DumpHook {
  async execute(fileName: string, callback: () => Promise<void>) {
    if(!existsSync(settings.cacheDir)) await this.createCacheDir();

    const filePath = path.join(settings.cacheDir, fileName);
    if(existsSync(filePath)) {
      await callback();
      await this.dump(filePath);
    } else {
      await this.restore(filePath);
    }
  }

  private async createCacheDir() {
    await new Promise((resolve, reject) => {
      exec(
        `mkdir -p ${settings.cacheDir}`,
        (error, stdout, stderr) => {
          if (error) {
            reject({ error: JSON.stringify(error), stderr });
            return;
          }

          resolve(undefined);
        }
      );
    });
  }

  private async dump(filePath: string) {
    await new Promise((resolve, reject) => {
      const args: string[] = ["-d", settings.database, "-a", "-x", "-O", "-f", filePath, "-Fc"];
      for(const table of settings.excludeTables) {
        args.push("-T", table)
      }
      exec(
        `pg_dump ${args.join(" ")}`,
        (error, stdout, stderr) => {
          if (error) {
            reject({ error: JSON.stringify(error), stderr });
            return;
          }

          resolve(undefined);
        }
      );
    });
  }

  private async restore(filePath: string) {
    await new Promise((resolve, reject) => {
      exec(
        `pg_restore -d ${settings.database} ${filePath}`,
        (error, stdout, stderr) => {
          if (error) {
            reject({ error: JSON.stringify(error), stderr });
            return;
          }

          resolve(undefined);
        }
      );
    });
  }
}
