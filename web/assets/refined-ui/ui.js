/* Screen ownership is explicit so that a migrated screen has one CSS cascade. */
window.RitmUI = (() => {
  function nav(items, selected, icon) {
    return items.map(([id, name, glyph]) =>
      '<button type="button" data-a="go:' + id + '" class="' +
      (id === selected ? 'active ' : '') + (id === 'pulse' ? 'pulse-nav' : '') +
      '" ' + (id === selected ? 'aria-current="page"' : '') + '>' +
      icon(glyph, 24) + '<span>' + name + '</span></button>').join('');
  }
  return {nav};
})();
