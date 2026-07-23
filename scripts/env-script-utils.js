const ENV_SCRIPT_TAG = '<script src="/env.js"></script>';

function findTagEnd(html, start) {
  let quote = "";
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return -1;
}

function readScriptSrc(openTag) {
  const match = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(openTag);
  return match ? (match[1] || match[2] || match[3] || "") : "";
}

function findScriptElements(html) {
  const scripts = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const commentEnd = html.indexOf("-->", start + 4);
      cursor = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }
    if (!/^<script(?:\s|>)/i.test(html.slice(start))) {
      cursor = start + 1;
      continue;
    }

    const openEnd = findTagEnd(html, start);
    if (openEnd < 0) break;
    const openTag = html.slice(start, openEnd + 1);
    const closePattern = /<\/script\s*>/ig;
    closePattern.lastIndex = openEnd + 1;
    const closeMatch = closePattern.exec(html);
    const end = closeMatch ? closePattern.lastIndex : openEnd + 1;
    scripts.push({ start, end, src: readScriptSrc(openTag), openTag });
    cursor = end;
  }

  return scripts;
}

function isEnvScriptSrc(src) {
  if (!src) return false;
  try {
    const resolved = new URL(src, "https://home-made.invalid/");
    return resolved.pathname === "/env.js" && !resolved.search && !resolved.hash;
  } catch {
    return false;
  }
}

function findEnvScriptElements(html) {
  return findScriptElements(html).filter((script) => isEnvScriptSrc(script.src));
}

function isSupabaseLibrarySrc(src) {
  return /(?:@supabase\/supabase-js|supabase(?:\.min)?\.js)/i.test(String(src || ""));
}

function ensureEnvScript(html) {
  const envScripts = findEnvScriptElements(html);
  if (envScripts.length > 1) {
    throw new Error(`Expected at most one env.js script element, found ${envScripts.length}.`);
  }

  const supabaseScript = findScriptElements(html).find((script) => isSupabaseLibrarySrc(script.src));
  const headEnd = html.search(/<\/head\s*>/i);
  if (headEnd < 0) throw new Error("Cannot inject env.js because </head> is missing.");
  const insertionIndex = supabaseScript ? supabaseScript.start : headEnd;

  if (envScripts.length === 1) {
    if (envScripts[0].start > insertionIndex) {
      throw new Error("The env.js script element must appear before the Supabase library.");
    }
    return { html, inserted: false };
  }

  return {
    html: `${html.slice(0, insertionIndex)}${ENV_SCRIPT_TAG}\n${html.slice(insertionIndex)}`,
    inserted: true
  };
}

module.exports = {
  ENV_SCRIPT_TAG,
  ensureEnvScript,
  findEnvScriptElements,
  findScriptElements,
  isEnvScriptSrc
};
