import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Dev-only resolver so Node can run the pure game logic (aliases + extensionless imports). */
export async function resolve(specifier, context, next) {
  let target = null;
  if (specifier.startsWith('@/')) target = resolvePath(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target && !/\.[cm]?[jt]s$/.test(target)) {
    for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }
  }
  return next(specifier, context);
}
