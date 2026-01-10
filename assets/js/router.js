// assets/js/router.js
export function pageUrl(filename) {
  // Resolve SEMPRE para a mesma pasta da página atual.
  // Ex.: estando em https://.../AVA3/login.html -> ./app.html vira https://.../AVA3/app.html
  return new URL(`./${filename}`, window.location.href).toString();
}

export function goTo(filename) {
  window.location.assign(pageUrl(filename));
}
