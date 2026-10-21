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
      "filename": "vendor/replicad/topology_copy_guarded_multi.wasm",
      "sha256": "b1fa5b3f65abe307f285b16c62f470b602778c2d8c3f15275b78d53aef1187fc"
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
export const CERTIFICATE_BUILD = "native-certificate-kernel-set-sha256:4cdda3034cd0ac26127b77a0a1b426b5105f9d0af0eb011c150ffa8172d7783f";
