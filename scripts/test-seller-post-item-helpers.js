const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "seller-post-item-helpers.js");
const source = fs.readFileSync(helperPath, "utf8");
const forbiddenDependencies = [
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "supabase",
  "hmAuth",
  "SELLERS",
  "ST",
  "ADM",
  "CART"
];

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

check("helper partial avoids browser and app state dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(source), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({});
vm.runInContext(source, context, { filename: helperPath });

const result = vm.runInContext(`
({
  nullValue: cleanPostItem(null),
  undefinedValue: cleanPostItem(undefined),
  emptyObject: cleanPostItem({}),
  fallbacks: cleanPostItem({ n: '', svs: '', img: '', imgPath: '', imgName: '' }),
  numericPrice: cleanPostItem({ p: 42 }),
  numericStringPrice: cleanPostItem({ p: '42.50' }),
  zeroPrice: cleanPostItem({ p: 0 }),
  decimalPrice: cleanPostItem({ p: 12.75 }),
  negativePrice: cleanPostItem({ p: -5 }),
  invalidPrice: cleanPostItem({ p: 'not-a-price' }),
  emptyPrice: cleanPostItem({ p: '' }),
  hotTrue: cleanPostItem({ hot: true }),
  hotFalse: cleanPostItem({ hot: false }),
  hotTruthy: cleanPostItem({ hot: 'yes' }),
  hotFalsy: cleanPostItem({ hot: 0 }),
  populated: cleanPostItem({
    n: 'Biryani',
    p: '89.95',
    svs: '2 servings',
    hot: 1,
    img: 'https://example.test/item.jpg',
    imgPath: 'seller/item.jpg',
    imgName: 'item.jpg'
  })
})
`, context, { filename: "seller-post-item-access-test.js" });

const laterAccess = vm.runInContext(`
cleanPostItem({ n: 'Later', p: '13.40', svs: '1', hot: 'yes', img: 'a', imgPath: 'b', imgName: 'c' })
`, context, { filename: "seller-post-item-later-script-test.js" });
const normalizedResult = JSON.parse(JSON.stringify(result));
const normalizedLaterAccess = JSON.parse(JSON.stringify(laterAccess));

const defaultItem = {
  n: "",
  p: 0,
  svs: "",
  hot: false,
  img: "",
  imgPath: "",
  imgName: ""
};
const expectedKeys = ["n", "p", "svs", "hot", "img", "imgPath", "imgName"];

check("null input uses current empty object fallback", () => assert.deepEqual(normalizedResult.nullValue, defaultItem));
check("undefined input uses current empty object fallback", () => assert.deepEqual(normalizedResult.undefinedValue, defaultItem));
check("empty object uses current field fallbacks", () => assert.deepEqual(normalizedResult.emptyObject, defaultItem));
check("empty string fields use current fallbacks", () => assert.deepEqual(normalizedResult.fallbacks, defaultItem));
check("item name and text/image fields are preserved", () => {
  assert.equal(normalizedResult.populated.n, "Biryani");
  assert.equal(normalizedResult.populated.svs, "2 servings");
  assert.equal(normalizedResult.populated.img, "https://example.test/item.jpg");
  assert.equal(normalizedResult.populated.imgPath, "seller/item.jpg");
  assert.equal(normalizedResult.populated.imgName, "item.jpg");
});
check("numeric price is preserved through parseFloat", () => assert.equal(normalizedResult.numericPrice.p, 42));
check("numeric-string price is preserved through parseFloat", () => assert.equal(normalizedResult.numericStringPrice.p, 42.5));
check("zero price uses current fallback value", () => assert.equal(normalizedResult.zeroPrice.p, 0));
check("decimal price is preserved", () => assert.equal(normalizedResult.decimalPrice.p, 12.75));
check("negative price is preserved", () => assert.equal(normalizedResult.negativePrice.p, -5));
check("invalid price uses current fallback value", () => assert.equal(normalizedResult.invalidPrice.p, 0));
check("empty price uses current fallback value", () => assert.equal(normalizedResult.emptyPrice.p, 0));
check("hot true remains true", () => assert.equal(normalizedResult.hotTrue.hot, true));
check("hot false remains false", () => assert.equal(normalizedResult.hotFalse.hot, false));
check("truthy hot value coerces to true", () => assert.equal(normalizedResult.hotTruthy.hot, true));
check("falsy hot value coerces to false", () => assert.equal(normalizedResult.hotFalsy.hot, false));
check("output object keys and order are preserved", () => assert.deepEqual(Object.keys(normalizedResult.populated), expectedKeys));
check("later classic script can access cleanPostItem by identifier", () => {
  assert.deepEqual(normalizedLaterAccess, {
    n: "Later",
    p: 13.4,
    svs: "1",
    hot: true,
    img: "a",
    imgPath: "b",
    imgName: "c"
  });
});

console.log(`Seller post item helper tests passed: ${checks}`);
