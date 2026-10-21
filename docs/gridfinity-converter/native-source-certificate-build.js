// Generated from explicitly selected active issuer/verifier kernels.
// Regenerate when any selected kernel or mapping changes.
export const CERTIFICATE_KERNEL_SET = Object.freeze({
  "protocol": "strict-brep-source-certificate-v2",
  "artifacts": {
    "issuer-single": {
      "filename": "vendor/replicad/model_exact_single.wasm",
      "sha256": "1569b1da4f75f7bcebddf8e18f1f32bd44388c8c00972cdb45923dc389f9078d"
    },
    "issuer-threaded": {
      "filename": "vendor/replicad/model_exact_multi.wasm",
      "sha256": "5deffc2a6307310bf54f161cf5f862ad72f0ddfcc14cb010258d2432a82a0a2c"
    },
    "verifier-single": {
      "filename": "vendor/export-verifier/destructor_fixed_single_verifier.wasm",
      "sha256": "e15b8822dbc7bde6737e5366faf1e831e702907f4109efc166f78d98cec2e5b3"
    },
    "verifier-threaded": {
      "filename": "vendor/export-verifier/step_selective_verifier.wasm",
      "sha256": "5ac23e719d1fc6c0de65715d581e944c250ecc3ed6f6cd49fd3c16d75e02c22f"
    }
  }
});
export const CERTIFICATE_BUILD = "native-certificate-kernel-set-sha256:621c29e71e5db50b48642f7aa6e99659ca4a7894abc6b3298828c804fb92a30a";
