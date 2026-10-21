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
      "filename": "vendor/export-verifier/analytic_writer17_single_verifier.wasm",
      "sha256": "febfd8038cb03abddcfe457d48c1112c45d2dc152f9567067f884d9b028bf667"
    },
    "verifier-threaded": {
      "filename": "vendor/export-verifier/writer17_torus_verifier.wasm",
      "sha256": "79477510c543664107816a9eea318c08e678251a1601d6b9f26a73550e317200"
    }
  }
});
export const CERTIFICATE_BUILD = "native-certificate-kernel-set-sha256:e2838b27229fc9a9cfcc1058a31dbb64e214a91d6212da7c27a56707b8a400f5";
