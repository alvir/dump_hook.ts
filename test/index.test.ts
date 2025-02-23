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

  it("creates default dumps location", async () => {
    expect(existsSync("tmp/dump_hook")).toBeFalsy();
    await dumpHook.execute("first", async () => {});
    expect(existsSync("tmp/dump_hook")).toBeTruthy();
  });

  it("creates dump file", async () => {
    const filepath = "tmp/dump_hook/first.dump";
    expect(existsSync(filepath)).toBeFalsy();
    await dumpHook.execute("first", async () => {});
    expect(existsSync(filepath)).toBeTruthy();
  });

  it("creates dump", async () => {
    expect(async () => {
      await dumpHook.execute("first_dump", async () => {});
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

    it("fills from callback", async () => {
      await dumpHook.execute("with_data", async () => {
        await sql`insert into t values('a', 'b')`;
      });
      expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
    });

    it("doesn't launch callback", async () => {
      await dumpHook.execute("with_data", async () => {
        await sql`insert into t values('a', 'b')`;
      });
      await sql`delete from t`;
      expect(await sql`select * from t`).toEqual([]);

      await dumpHook.execute("with_data", async () => {});
      expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);

      await dumpHook.execute("with_data", async () => {});
      expect(await sql`select * from t`).toEqual([
        { a: "a", b: "b" },
        { a: "a", b: "b" }
      ]);
    });

    describe("excludeTables", () => {
      beforeEach(async () => {
        await sql`create table t2 (c text, d text)`;
        await sql`insert into t2 values('c', 'd')`;
        dumpHook = new DumpHook({ database: database, excludeTables: ["t2"] });
        await dumpHook.execute("with_data", async () => {
          await sql`insert into t values('a', 'b')`;
        });
      });

      it("returns the same for previous tables", async () => {
        expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
      });

      it("returns the existing values for excluded tables", async () => {
        expect(await sql`select * from t2`).toEqual([{ c: "c", d: "d" }]);
      });

      describe("on next execution", () => {
        beforeEach(async () => {
          await dumpHook.execute("with_data", async () => {});
        });

        it("works the same for not ignored tables", async () => {
          expect(await sql`select * from t`).toEqual([
            { a: "a", b: "b" },
            { a: "a", b: "b" }
          ]);
        });

        it("doesn't change ignored tables", async () => {
          expect(await sql`select * from t2`).toEqual([{ c: "c", d: "d" }]);
        });
      });
    });

    describe("schemas", () => {
      beforeEach(async () => {
        await sql`create schema other`;
        await sql`create table other.t (a text, b text)`;
        await sql`insert into other.t values('other_a', 'other_b')`;
      });

      describe("by default", () => {
        beforeEach(async () => {
          await dumpHook.execute("with_data", async () => {
            await sql`insert into public.t values('a', 'b')`;
          });
        });

        it("works the same", async () => {
          expect(await sql`select * from other.t`).toEqual([
            { a: "other_a", b: "other_b" }
          ]);
          expect(await sql`select * from public.t`).toEqual([
            { a: "a", b: "b" }
          ]);
        });

        it("dumps just public", async () => {
          await dumpHook.execute("with_data", async () => {});
          expect(await sql`select * from other.t`).toEqual([
            { a: "other_a", b: "other_b" }
          ]);
          expect(await sql`select * from public.t`).toEqual([
            { a: "a", b: "b" },
            { a: "a", b: "b" }
          ]);
        });
      });

      describe("with additional schema", () => {
        beforeEach(async () => {
          dumpHook = new DumpHook({
            database: database,
            schemas: ["public", "other"]
          });
          await dumpHook.execute("with_data", async () => {
            await sql`insert into public.t values('a', 'b')`;
          });
        });

        it("works the same", async () => {
          expect(await sql`select * from other.t`).toEqual([
            { a: "other_a", b: "other_b" }
          ]);
          expect(await sql`select * from public.t`).toEqual([
            { a: "a", b: "b" }
          ]);
        });

        it("dumps all mentioned schemas", async () => {
          await dumpHook.execute("with_data", async () => {});
          expect(await sql`select * from other.t`).toEqual([
            { a: "other_a", b: "other_b" },
            { a: "other_a", b: "other_b" }
          ]);
          expect(await sql`select * from public.t`).toEqual([
            { a: "a", b: "b" },
            { a: "a", b: "b" }
          ]);
        });
      });
    });

    describe("recreate", () => {
      beforeEach(async () => {
        await dumpHook.execute("with_data", async () => {
          await sql`insert into t values('a', 'b')`;
        });
      });

      describe("by default", () => {
        it("doesn't change db", async () => {
          expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
          await sql`delete from t`;
          await dumpHook.execute("with_data", async () => {
            await sql`insert into t values('c', 'd')`;
          });
          expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
        })
      });

      describe("with recreate in params", () => {
        beforeEach(() => {
          dumpHook = new DumpHook({ database: database, recreate: true });
        })

        it("changes db", async () => {
          expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
          await sql`delete from t`;
          await dumpHook.execute("with_data", async () => {
            await sql`insert into t values('c', 'd')`;
          });
          expect(await sql`select * from t`).toEqual([{ a: "c", b: "d" }]);
        })

        describe("when executing several times", () => {
          beforeEach(async () => {
            await sql`delete from t`;
            await dumpHook.execute("with_data", async () => {
              await sql`insert into t values('c', 'd')`;
            });
          })

          it("uses dump", async () => {
            await sql`delete from t`;
            await dumpHook.execute("with_data", async () => {
              await sql`insert into t values('e', 'f')`;
            });
            expect(await sql`select * from t`).toEqual([{ a: "c", b: "d" }]);
          })
        })
      });

      describe("with recreate in env variables", () => {
        beforeEach(() => {
          process.env.DUMP_HOOK = "recreate";
          dumpHook = new DumpHook({ database: database });
        })

        afterEach(() => {
          process.env.DUMP_HOOK = undefined;
        })

        it("changes db", async () => {
          expect(await sql`select * from t`).toEqual([{ a: "a", b: "b" }]);
          await sql`delete from t`;
          await dumpHook.execute("with_data", async () => {
            await sql`insert into t values('c', 'd')`;
          });
          expect(await sql`select * from t`).toEqual([{ a: "c", b: "d" }]);
        })

        describe("when executing several times", () => {
          beforeEach(async () => {
            process.env.DUMP_HOOK = "recreate";
            await sql`delete from t`;
            await dumpHook.execute("with_data", async () => {
              await sql`insert into t values('c', 'd')`;
            });
          })

          it("uses dump", async () => {
            await sql`delete from t`;
            await dumpHook.execute("with_data", async () => {
              await sql`insert into t values('e', 'f')`;
            });
            expect(await sql`select * from t`).toEqual([{ a: "c", b: "d" }]);
          })
        })
      });
    });
  });
});
