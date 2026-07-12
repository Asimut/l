/**
 * Hermes Movie v10 — минимальный тест: только кнопка + уведомление
 * Установка: https://asimut.github.io/l/b.js
 */
(function(){
'use strict';

// ═══ КНОПКА ═══
function addButton(render, movie){
    try {
        if (!render) return;
        if (render.find('.hermes-btn').length) return;

        var btn = $('<div class="full-start__button selector hermes-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)"><span>Hermes</span></div>');

        btn.on('hover:enter', function(){
            try {
                if (typeof Lampa !== 'undefined' && Lampa.Noty) {
                    Lampa.Noty.show('Кнопка работает! Фильм: ' + (movie ? (movie.title || '?') : '?'));
                }
            } catch(e) {}
        });

        render.after(btn);
    } catch(e) {}
}

// ═══ СЛУШАТЕЛЬ ═══
try {
    if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('full', function(e){
            try {
                if (e && e.type === 'complite' && e.object && e.object.activity) {
                    var act = e.object.activity;
                    if (act.render) {
                        var r = act.render();
                        if (r) {
                            var torrent = r.find('.view--torrent');
                            if (torrent && torrent.length) {
                                addButton(torrent, e.data ? e.data.movie : null);
                            }
                        }
                    }
                }
            } catch(e) {}
        });
    }
} catch(e) {}

// ═══ УВЕДОМЛЕНИЕ ═══
try {
    if (typeof Lampa !== 'undefined' && Lampa.Noty) {
        Lampa.Noty.show('✅ Hermes v10 загружен!');
    }
} catch(e) {}

})();
