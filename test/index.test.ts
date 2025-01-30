import { DumpHook } from "../src";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "fs";
import postgres from "postgres";

describe("execute", () => {
  const database = "dump_hook_ts_test";
  let dumpHook: DumpHook;

  beforeEach(() => {
    execSync(`createdb ${database}`);

    dumpHook = new DumpHook({
      database: database
    });
  });

  afterEach(() => {
    execSync(`dropdb ${database}`);
    rmSync("tmp", { recursive: true });
  });

  test("create default dumps location", async () => {
    expect(existsSync("tmp/dump_hook")).toBeFalsy();
    await dumpHook!.execute("first", async () => {});
    expect(existsSync("tmp/dump_hook")).toBeTruthy();
  });

  test("create dump file", async () => {
    const filepath = "tmp/dump_hook/first.dump";
    expect(existsSync(filepath)).toBeFalsy();
    await dumpHook!.execute("first", async () => {});
    expect(existsSync(filepath)).toBeTruthy();
  });

  test("create dump", async () => {
    expect(async () => {
      await dumpHook!.execute("first_dump", async () => {});
    }).not.toThrow();
  });

  describe("with data", () => {
    let sql: ReturnType<typeof postgres>;

    beforeEach(async () => {
      sql = postgres({ database: database });
      await sql`create table t (a text, b text)`;
    });

    afterEach(async () => {
      await sql.end();
    });

    test("fill from callback", async () => {
      await dumpHook.execute("with_data", async () => {
        await sql`insert into t values('a', 'b')`;
      });
      expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
    });

    test("don't launch call back", async () => {
      await dumpHook.execute("with_data", async () => {
        await sql`insert into t values('a', 'b')`;
      });
      await sql`delete from t`;
      expect(await sql`select * from t`).toEqual([]);

      await dumpHook.execute("with_data", async () => {});
      expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
    });
  });
});
