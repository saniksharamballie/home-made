const { methodAllowed, sendJson, handleError } = require("./_lib/supabase");
const { validateDraftImagesForPublication } = require("./_lib/draft-image-security");

const MAX_DRAFT_IMAGE_REQUEST_BYTES = 64 * 1024;

async function readJsonLimited(req, limit = MAX_DRAFT_IMAGE_REQUEST_BYTES) {
  if (req.body && typeof req.body === "object") {
    if (Buffer.byteLength(JSON.stringify(req.body), "utf8") > limit) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > limit) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;
  try {
    const body = await readJsonLimited(req);
    const result = await validateDraftImagesForPublication(req, body);
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = handler;
module.exports._test = { MAX_DRAFT_IMAGE_REQUEST_BYTES, readJsonLimited, validateDraftImagesForPublication };
