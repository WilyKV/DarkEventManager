import { Table, getTableName, is } from "drizzle-orm";
import { defineConfig } from "drizzle-kit";
import baseConfig from "./drizzle.config";
import * as schema from "./shared/schema";

export default defineConfig({
  ...baseConfig,
  // Leave tables outside the application's schema alone.
  tablesFilter: Object.values(schema).filter(value => is(value, Table)).map(getTableName),
});
