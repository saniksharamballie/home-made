const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const api = require("../api/draft-images.js")._test;
const security = require("../api/_lib/draft-image-security.js");

const authId = "11111111-1111-4111-8111-111111111111";
const sellerId = "42";
const config = { url: "http://127.0.0.1:54321", anonKey: "local-anon", serviceKey: "local-service" };
const request = { headers: { authorization: "Bearer local-test-token" } };

function image(index, overrides = {}) {
  const suffix = String(index).padStart(12, "0");
  return {
    bucket: "seller-draft-images",
    path: `drafts/${authId}/${sellerId}/22222222-2222-4222-8222-${suffix}.webp`,
    mimeType: "image/webp",
    size: 100,
    width: 10,
    height: 10,
    ...overrides
  };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}

async function validate(images, overrides = {}) {
  let storageCalls = 0;
  let activeStorage = 0;
  let maximumStorage = 0;
  const fetch = async (url) => {
    if (url.includes("/auth/v1/user")) return response(200, { id: authId });
    if (url.includes("/rest/v1/sellers")) return response(200, [{ id: 42, auth_id: authId, active: false }]);
    if (url.includes("/storage/v1/object/info/")) {
      storageCalls += 1;
      activeStorage += 1;
      maximumStorage = Math.max(maximumStorage, activeStorage);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeStorage -= 1;
      return response(200, { contentType: "image/webp", size: 100 });
    }
    throw new Error("unexpected request");
  };
  const result = await security.validateDraftImagesForPublication(
    request,
    { action: "validate-publication", sellerId, images },
    { config, fetch, ...overrides }
  );
  return { result, storageCalls, maximumStorage };
}

(async () => {
  await assert.rejects(
    api.readJsonLimited({ body: { value: "x".repeat(api.MAX_DRAFT_IMAGE_REQUEST_BYTES) } }),
    (error) => error.status === 413
  );
  const parsed = await api.readJsonLimited(Readable.from([Buffer.from('{"ok":true}')]));
  assert.deepEqual(parsed, { ok: true });

  const duplicate = await validate([image(1), image(1)]);
  assert.equal(duplicate.result.count, 1);
  assert.equal(duplicate.storageCalls, 1);

  let trustedCalls = 0;
  await assert.rejects(
    security.validateDraftImagesForPublication(request, {
      action: "validate-publication",
      sellerId,
      images: Array.from({ length: security.MAX_DRAFT_IMAGE_COUNT + 1 }, (_, index) => image(index))
    }, { config, fetch: async () => { trustedCalls += 1; throw new Error("must not run"); } }),
    (error) => error.status === 400
  );
  assert.equal(trustedCalls, 0);

  for (const invalid of [
    image(1, { path: "malformed" }),
    image(1, { bucket: "seller-images" })
  ]) {
    trustedCalls = 0;
    await assert.rejects(
      security.validateDraftImagesForPublication(request, { action: "validate-publication", sellerId, images: [invalid] }, {
        config,
        fetch: async () => { trustedCalls += 1; throw new Error("must not run"); }
      }),
      (error) => error.status === 400
    );
    assert.equal(trustedCalls, 0);
  }

  const bounded = await validate(Array.from({ length: 10 }, (_, index) => image(index)));
  assert.equal(bounded.storageCalls, 10);
  assert.ok(bounded.maximumStorage <= security.MAX_STORAGE_CHECK_CONCURRENCY);

  await assert.rejects(
    security.validateDraftImagesForPublication(request, {
      action: "validate-publication",
      sellerId,
      images: [image(1, { path: image(1).path.replace(authId, "33333333-3333-4333-8333-333333333333") })]
    }, { config, fetch: async (url) => {
      if (url.includes("/auth/v1/user")) return response(200, { id: authId });
      if (url.includes("/rest/v1/sellers")) return response(200, [{ id: 42, auth_id: authId, active: false }]);
      throw new Error("storage must not run");
    } }),
    (error) => error.status === 403 && !/exist|path|object/i.test(error.message)
  );

  console.log("Draft image API bound tests passed.");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
