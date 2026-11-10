// WebKit disables even host-registered DOM callbacks in a frame without
// allow-scripts. Apply a restrictive CSP before the EPUB document is rendered
// instead: reader callbacks keep working, while book-authored scripts cannot run.
export function protectBookDocument(document: Document) {
  const root = document.documentElement;
  if (root.localName.toLowerCase() !== 'html') {
    throw new Error('不支持的 EPUB 章节格式。');
  }
  let head = Array.from(root.children).find(element =>
    element.localName.toLowerCase() === 'head' && element.namespaceURI === root.namespaceURI
  );
  if (!head) { head = document.createElementNS(root.namespaceURI, 'head'); }
  // The policy must precede all book content, including scripts in the head.
  root.insertBefore(head, root.firstChild);
  const policy = document.createElementNS(root.namespaceURI, 'meta');
  policy.setAttribute('http-equiv', 'Content-Security-Policy');
  policy.setAttribute('content', "script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'");
  head.insertBefore(policy, head.firstChild);
  // A refresh must not replace this protected document with an unprotected one.
  document.querySelectorAll('meta[http-equiv]').forEach(meta => {
    if (meta.getAttribute('http-equiv').trim().toLowerCase() === 'refresh') {
      meta.removeAttribute('http-equiv');
      meta.removeAttribute('content');
    }
  });
}

export function protectBookNavigation(contents: ePub.Contents) {
  contents.document.addEventListener('click', event => {
    // Internal chapter links are handled by epub.js's own click handlers. Stop
    // default frame navigation, including SVG links epub.js does not intercept.
    if ((event.target as Element).closest?.('a, area')) { event.preventDefault(); }
  }, true);
}
