// This immediately-invoked function returns the page data object
(() => {
  return {
    title: document.title,
    url: window.location.href,
    text: document.body.innerText
  };
})();