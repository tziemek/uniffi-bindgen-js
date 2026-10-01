/**
 * FFI-mode smoke test: `[ByRef] bytes` / `&[u8]` arguments.
 *
 * Verifies the `ForeignBytes` (pointer + length) ABI introduced in
 * uniffi >= 0.32 for `[ByRef] bytes` args — as opposed to the `RustBuffer`
 * ABI used for owned `bytes` args. Exercises:
 *  - a top-level function taking only a borrowed byte buffer
 *  - a top-level function mixing a borrowed buffer with owned scalar/bytes
 *    args (checks FFI element-offset math)
 *  - an object method taking a borrowed byte buffer (in addition to the
 *    synthetic `this` handle argument)
 *  - that the caller's buffer is left untouched / still usable afterwards
 *    (proves the callee only *borrowed* it, not stole/aliased it)
 *  - large buffers and repeated calls (no leaks / no scratch-space
 *    exhaustion, since ForeignBytes bypasses the fixed-size scratch region)
 */

import { describe, it, expect } from 'vitest';
import { FfiByrefBytes, BytesAccumulator } from '../generated/ffi_byref_bytes.js';

describe('FfiByrefBytes.sumBytes', () => {
  it('sums bytes without taking ownership', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    expect(FfiByrefBytes.sumBytes(data)).toBe(15n);
    // Buffer must remain untouched and reusable after the call.
    expect(Array.from(data)).toEqual([1, 2, 3, 4, 5]);
    expect(FfiByrefBytes.sumBytes(data)).toBe(15n);
  });

  it('handles an empty buffer', () => {
    expect(FfiByrefBytes.sumBytes(new Uint8Array([]))).toBe(0n);
  });

  it('handles a large buffer (bypasses the fixed scratch region)', () => {
    const data = new Uint8Array(100_000).fill(1);
    expect(FfiByrefBytes.sumBytes(data)).toBe(100_000n);
  });

  it('does not leak across many repeated calls', () => {
    const data = new Uint8Array([10, 20, 30]);
    for (let i = 0; i < 500; i++) {
      expect(FfiByrefBytes.sumBytes(data)).toBe(60n);
    }
  });
});

describe('FfiByrefBytes.xorBytes', () => {
  it('interleaves a borrowed buffer with scalar and owned-bytes args', () => {
    const data = new Uint8Array([0x00, 0xff, 0x0f]);
    const suffix = new Uint8Array([9, 9]);
    const result = FfiByrefBytes.xorBytes(data, 0xff, suffix);
    expect(Array.from(result)).toEqual([0xff, 0x00, 0xf0, 9, 9]);
    // `data` was borrowed, not consumed — still intact afterwards.
    expect(Array.from(data)).toEqual([0x00, 0xff, 0x0f]);
  });
});

describe('BytesAccumulator.accumulate (object method)', () => {
  it('accumulates across multiple borrowed-buffer calls', () => {
    const acc = BytesAccumulator.create(100n);
    expect(acc.accumulate(new Uint8Array([1, 2, 3]))).toBe(106n);
    expect(acc.accumulate(new Uint8Array([4, 5]))).toBe(115n);
    acc.free();
  });

  it('reuses the same borrowed buffer for multiple calls', () => {
    const acc = BytesAccumulator.create(0n);
    const data = new Uint8Array([1, 1, 1]);
    expect(acc.accumulate(data)).toBe(3n);
    expect(acc.accumulate(data)).toBe(6n);
    expect(Array.from(data)).toEqual([1, 1, 1]);
    acc.free();
  });
});
