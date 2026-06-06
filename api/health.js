const { sendJson } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "home-made-api",
    version: "v1"
  });
};
