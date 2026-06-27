// SPDX-License-Identifier: Apache-2.0
// Example: migrate stream data from contract v1 to v2 (#505)
// v2 adds cliff_time and delegate fields introduced in the current contract.

'use strict';

/** @type {import('./migrationRunner').Migration} */
module.exports = {
  version: '0002',
  description: 'Add cliff_time and delegate fields to stream records',

  async up(streams) {
    return streams.map((s) => ({
      ...s,
      cliff_time: s.cliff_time ?? 0,
      delegate: s.delegate ?? null,
    }));
  },

  async down(streams) {
    return streams.map(({ cliff_time: _c, delegate: _d, ...rest }) => rest);
  },

  async validate(streams) {
    for (const s of streams) {
      if (typeof s.stream_id === 'undefined' && typeof s.id === 'undefined') {
        return { ok: false, reason: `Stream missing id field: ${JSON.stringify(s)}` };
      }
    }
    return { ok: true };
  },
};
