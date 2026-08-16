(function(){
  var stage = document.getElementById('stage');

  document.getElementById('viewGroup').addEventListener('click', function(e){
    var btn = e.target.closest('button'); if(!btn) return;
    stage.classList.remove('solo-a','solo-b');
    if(btn.dataset.view !== 'both') stage.classList.add(btn.dataset.view);
    setOn(this, btn);
  });

  document.getElementById('widthGroup').addEventListener('click', function(e){
    var btn = e.target.closest('button'); if(!btn) return;
    var w = btn.dataset.w;
    ['holdA','holdB'].forEach(function(id){
      var hold = document.getElementById(id);
      var frame = hold.querySelector('iframe');
      if(w === '0'){ hold.removeAttribute('data-w'); frame.style.width = '100%'; frame.style.maxWidth = 'none'; }
      else { hold.setAttribute('data-w', w); frame.style.width = w + 'px'; frame.style.maxWidth = '100%'; }
    });
    setOn(this, btn);
  });

  document.getElementById('syncBtn').addEventListener('click', function(){
    ['frameA','frameB'].forEach(function(id){
      var f = document.getElementById(id);
      f.src = f.src;
    });
  });

  function setOn(group, btn){
    Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){
      b.classList.toggle('on', b === btn);
    });
  }

  /* Default to the phone width both pages are actually used at. */
  ['holdA','holdB'].forEach(function(id){
    var hold = document.getElementById(id);
    hold.setAttribute('data-w','390');
    var f = hold.querySelector('iframe');
    f.style.width = '390px';
    f.style.maxWidth = '100%';
  });
}());
