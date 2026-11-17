// Cross-origin isolation so onnxruntime-web can use multi-threaded WASM.
export default {
  server: {
    port: 5199,
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
  },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
};
