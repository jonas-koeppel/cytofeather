# Bundled PDF dependency

`jspdf.umd.min.js` is jsPDF 2.5.1, the same pinned version previously loaded from the CDN. It is now served with the app so exports do not depend on third-party requests.

- Source: https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js
- Upstream: https://github.com/parallax/jsPDF/tree/v2.5.1
- License: MIT; the full license and bundled dependency notices are retained in the file header.

The app uses jsPDF's vector drawing/text APIs. It does not use its HTML rendering or remote image-loading features. Review upstream releases and test all four plot modes before changing this version.
