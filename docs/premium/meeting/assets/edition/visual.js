window.RitmVisual = (() => {
  const pulseTrace = '<svg class="pulse-trace" viewBox="0 0 104 30" aria-hidden="true"><path pathLength="100" d="M1 17h25l5-5 7 10 11-19 9 25 8-11h37"/></svg>';
  function photoRow(photo, icon, escape, {art, kicker, title, note, action}) {
    return '<button class="edition-row" data-a="'+escape(action)+'">'+(art?photo(art,'','thumb'):'')+
      '<span class="row-lines"><small>'+escape(kicker)+'</small><strong>'+escape(title)+'</strong><span>'+escape(note)+'</span></span>'+icon('arrow-up-right',16)+'</button>';
  }
  function hero(photo,icon,escape,{art,kicker,title,note,action}) {
    return '<button class="edition-hero" data-a="'+escape(action)+'">'+photo(art,'')+
      '<span class="hero-legend"><span class="hero-copy"><small>'+escape(kicker)+'</small><strong>'+escape(title)+'</strong><span>'+escape(note)+'</span></span>'+icon('arrow-up-right',21)+'</span></button>';
  }
  function figure(person, demo, escape) {
    return '<span class="edition-face">'+RitmHome.portrait({person:person.id,name:person.name},demo,escape)+'</span>';
  }
  return {pulseTrace,photoRow,hero,figure};
})();
