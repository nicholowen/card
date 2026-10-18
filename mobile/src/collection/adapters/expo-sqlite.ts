import type { SQLiteDatabase } from "expo-sqlite";
import type { LocalDatabase, SqlValue } from "../ports";

export function expoSqliteDatabase(db: SQLiteDatabase): LocalDatabase {
  return {
    async execute(sql: string, params: SqlValue[] = []) {
      if (params.length === 0) await db.execAsync(sql);
      else await db.runAsync(sql, params);
    },
    async all<Row>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<Row>(sql, params);
    },
  };
}
