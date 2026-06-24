// Minimal fixture factory with optional seeding for reproducibility.
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function defaultRng(seed) {
  if (typeof seed === 'number') return mulberry32(seed);
  return Math.random;
}

function userFactory(opts = {}) {
  const rng = defaultRng(opts.seed);
  const id = Math.floor(rng() * 1000000);
  const name = `user-${id}`;
  const email = `${name}@example.com`;
  return Object.assign({ id, name, email, active: true }, opts.overrides || {});
}

module.exports = { userFactory };
