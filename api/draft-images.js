const { methodAllowed, readJson, sendJson, handleError } = require("./_lib/supabase");
const { validateDraftImagesForPublication } = require("./_lib/draft-image-security");

async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;
  try {
    const body = await readJson(req);
    const result = await validateDraftImagesForPublication(req, body);
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = handler;
module.exports._test = { validateDraftImagesForPublication };
