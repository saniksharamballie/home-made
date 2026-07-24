const assert = require("node:assert/strict");
const cleanup = require("./cleanup-draft-image-orphans.js");
const localRls = require("./test-local-storage-rls.js");

const stagingConfig = { url: `https://${cleanup.APPROVED_STAGING_REF}.supabase.co` };

assert.equal(cleanup.assertCleanupExecutionTarget(stagingConfig, { execute: false }).mode, "dry-run");
assert.throws(
  () => cleanup.assertCleanupExecutionTarget(stagingConfig, { execute: true }),
  /confirmation|project ref/
);
assert.throws(
  () => cleanup.assertCleanupExecutionTarget(stagingConfig, {
    execute: true,
    expectedRef: cleanup.FORBIDDEN_PRODUCTION_REF,
    confirm: "seller-draft-images"
  }),
  /Production/
);
assert.throws(
  () => cleanup.assertCleanupExecutionTarget({ url: "https://unknown.example" }, {
    execute: true,
    expectedRef: cleanup.APPROVED_STAGING_REF,
    confirm: "seller-draft-images"
  }),
  /does not match/
);
assert.equal(cleanup.assertCleanupExecutionTarget(stagingConfig, {
  execute: true,
  expectedRef: cleanup.APPROVED_STAGING_REF,
  confirm: "seller-draft-images"
}).allowed, true);

assert.equal(cleanup.normalizeDeleteBatchSize(), 25);
assert.equal(cleanup.normalizeDeleteBatchSize(100), 100);
assert.throws(() => cleanup.normalizeDeleteBatchSize(101), /between 1 and 100/);
assert.throws(() => cleanup.normalizeDeleteBatchSize(0), /between 1 and 100/);
assert.match(cleanup.redactedProjectRef(cleanup.APPROVED_STAGING_REF), /^[a-z0-9]{4}\.\.\.[a-z0-9]{4}$/);
assert.doesNotMatch(cleanup.redactedProjectRef(cleanup.APPROVED_STAGING_REF), new RegExp(cleanup.APPROVED_STAGING_REF));
assert.equal(localRls.localTarget("http://127.0.0.1:54321"), "http://127.0.0.1:54321");
assert.equal(localRls.localTarget(`https://${cleanup.APPROVED_STAGING_REF}.supabase.co`), null);
assert.equal(localRls.localTarget(`https://${cleanup.FORBIDDEN_PRODUCTION_REF}.supabase.co`), null);
assert.equal(localRls.localTarget("https://unknown.supabase.co"), null);

function path(index) {
  const suffix = String(index).padStart(12, "0");
  return `drafts/11111111-1111-4111-8111-111111111111/42/22222222-2222-4222-8222-${suffix}.webp`;
}

(async () => {
  const batches = [];
  const result = await cleanup.deletePrivateDraftObjects(stagingConfig, Array.from({ length: 61 }, (_, index) => path(index)), {
    batchSize: 25,
    request: async (config, target, options) => {
      assert.equal(target, "/storage/v1/object/seller-draft-images");
      const values = JSON.parse(options.body).prefixes;
      assert.ok(values.length <= 25);
      batches.push(values.length);
    }
  });
  assert.deepEqual(batches, [25, 25, 11]);
  assert.equal(result.deleted, 61);
  assert.equal(result.failed, 0);

  let attempts = 0;
  const failed = await cleanup.deletePrivateDraftObjects(stagingConfig, Array.from({ length: 80 }, (_, index) => path(index)), {
    batchSize: 25,
    failureThreshold: 2,
    request: async () => {
      attempts += 1;
      throw new Error("simulated");
    }
  });
  assert.equal(attempts, 2);
  assert.equal(failed.batchesFailed, 2);
  assert.equal(failed.stopped, true);

  const ignored = await cleanup.deletePrivateDraftObjects(stagingConfig, ["seller-images/unrelated.webp", "malformed"], {
    request: async () => { throw new Error("must not run"); }
  });
  assert.equal(ignored.requested, 0);

  console.log("Draft image cleanup safety tests passed.");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
