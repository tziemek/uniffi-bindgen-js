//! Fixture crate for `[ByRef] bytes` / `&[u8]` argument support (ForeignBytes
//! ABI, uniffi >= 0.32). See fixtures/ffi-byref-bytes/src/ffi_byref_bytes.udl
//! for the mirrored UDL interface used to drive JS binding generation.

/// Sums the bytes as unsigned values. Takes the buffer by reference — the
/// caller retains ownership, and Rust never frees it.
#[uniffi::export]
pub fn sum_bytes(data: &[u8]) -> u64 {
    data.iter().map(|&b| b as u64).sum()
}

/// XORs `data` (borrowed) with `key`, then appends `suffix` (owned).
/// Exercises a `[ByRef] bytes` arg interleaved with plain scalar and owned
/// `bytes` arguments in the same call.
#[uniffi::export]
pub fn xor_bytes(data: &[u8], key: u8, suffix: Vec<u8>) -> Vec<u8> {
    let mut result: Vec<u8> = data.iter().map(|&b| b ^ key).collect();
    result.extend(suffix);
    result
}

#[derive(uniffi::Object)]
pub struct BytesAccumulator {
    seed: std::sync::Mutex<u64>,
}

#[uniffi::export]
impl BytesAccumulator {
    #[uniffi::constructor]
    pub fn new(seed: u64) -> Self {
        Self {
            seed: std::sync::Mutex::new(seed),
        }
    }

    /// Adds the sum of `data` (borrowed) to the running total and returns it.
    pub fn accumulate(&self, data: &[u8]) -> u64 {
        let sum: u64 = data.iter().map(|&b| b as u64).sum();
        let mut seed = self.seed.lock().unwrap();
        *seed += sum;
        *seed
    }
}

uniffi::setup_scaffolding!();
