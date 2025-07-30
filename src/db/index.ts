import { drizzle } from 'drizzle-orm/d1';
import { Env } from '../types';
import * as schema from './schema';

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export { schema };
export * from './schema';