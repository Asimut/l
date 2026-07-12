/**
 * Hermes Movie v11 — поиск с исправленными callback-ами
 * Установка: https://asimut.github.io/l/b.js
 */
(function(){
'use strict';

var SOURCES = [
    {id:'rezka',   name:'HDRezka',  url:'https://hdrezka.ag',  search:'/engine/ajax/search.php',        type:'rezka'},
    {id:'filmix',  name:'Filmix',   url:'https://filmix.ac',   search:'/api/v2/search',                 type:'json'},
    {id:'kinogo',  name:'Kinogo',   url:'https://kinogo.zone', search:'/search',                         type:'html'},
    {id:'anwap',   name:'ANWAP',    url:'https://anwap.love',  search:'/api/v2/search',                 type:'json'},
    {id:'uakino',  name:'UAKino',   url:'https://uakino.me',   search:'/index.php?do=search',            type:'html'},
    {id:'uafix',   name:'UAFix',    url:'https://uafix.net',   search:'/api/v1/search',                 type:'json'},
    {id:'eneyida', name:'Eneyida',  url:'https://eneyida.tv',  search:'/index.php?do=search',            type:'html'},
    {id:'uafilm',  name:'UAFilm',   url:'https://uafilm.tv',   search:'/index.php?do=search',            type:'html'}
];

// --- HTTP (исправлено: get=2 аргумента, post=3) ---
function get(url, cb){
    var x = new XMLHttpRequest();
    x.timeout = 10000;
    x.open('GET', url, true);
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send();
}

function post(url, body, cb){
    var x = new XMLHttpRequest();
    x.timeout = 10000;
    x.open('POST', url, true);
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send(body);
}

function parseList(data){
    try {
        var d = JSON.parse(data);
        var items = d.data || d.results || d.items || d.rows || d;
        if (items && typeof items === 'object' && !(items instanceof Array)) {
            var keys = Object.keys(items);
            for (var i = 0; i < keys.length; i++) {
                if (items[keys[i]] instanceof Array) { items = items[keys[i]]; break; }
            }
        }
        if (!(items instanceof Array)) return [];
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            out.push({title: it.title || it.name || '', url: it.url || it.link || ''});
        }
        return out;
    } catch(e) { return []; }
}

function parseHTML(text, baseUrl){
    var re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{3,120})<\/a>/gi;
    var m, seen = {}, out = [];
    while ((m = re.exec(text)) !== null && out.length < 20) {
        var t = m[2].replace(/<[^>]+>/g, '').trim();
        if (t.length > 2 && !seen[t]) {
            seen[t] = 1;
            var href = m[1];
            if (href.indexOf('http') !== 0) href = baseUrl.replace(/\/$/, '') + '/' + href.replace(/^\//, '');
            out.push({title: t, url: href});
        }
    }
    return out;
}

function searchSource(src, query, cb){
    var url = src.url + src.search;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    url += sep + 'q=' + encodeURIComponent(query);

    if (src.type === 'rezka') {
        // HDRezka: POST
        post(src.url + src.search, 'q=' + encodeURIComponent(query), function(err, data){
            if (err || !data) { cb([]); return; }
            cb(parseList(data));
        });
    } else {
        // Остальные: GET
        get(url, function(err, data){
            if (err || !data) { cb([]); return; }
            if (src.type === 'json') cb(parseList(data));
            else cb(parseHTML(data, src.url));
        });
    }
}

function searchAll(query, cb){
    var all = [], done = 0, total = SOURCES.length;
    function onResult(results){
        done++;
        if (results && results.length) all = all.concat(results);
        if (done >= total) {
            var seen = {}, uniq = [];
            for (var j = 0; j < all.length; j++) {
                var k = (all[j].title || '').toLowerCase().trim();
                if (!seen[k]) { seen[k] = 1; uniq.push(all[j]); }
            }
            cb(uniq);
        }
    }
    for (var i = 0; i < total; i++) {
        searchSource(SOURCES[i], query, onResult);
    }
}

// ═══ КНОПКА (v10-стиль, проверенный) ═══
function addButton(render, movie){
    try {
        if (!render) return;
        if (render.find('.hermes-btn').length) return;

        var btn = $('<div class="full-start__button selector hermes-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)"><span>Hermes</span></div>');

        btn.on('hover:enter', function(){
            try {
                var title = movie ? (movie.title || movie.original_title || movie.name || '') : '';
                if (!title) { Lampa.Noty.show('Название не найдено'); return; }

                Lampa.Noty.show('Ищу: ' + title + '...');

                searchAll(title, function(results){
                    if (!results || results.length === 0) {
                        Lampa.Noty.show('Ничего не найдено');
                        return;
                    }
                    var items = [];
                    for (var i = 0; i < results.length; i++) {
                        items.push({
                            title: results[i].title || 'Без названия',
                            url: results[i].url || ''
                        });
                    }
                    Lampa.Select.show({
                        title: 'Hermes: ' + title + ' (' + items.length + ')',
                        items: items,
                        onSelect: function(item){
                            if (item.url) {
                                try { window.open(item.url, '_blank'); } catch(e) {}
                                Lampa.Noty.show(item.title);
                            }
                        }
                    });
                });
            } catch(e) {
                Lampa.Noty.show('Ошибка: ' + (e.message || e));
            }
        });

        render.after(btn);
    } catch(e) {}
}

// ═══ СЛУШАТЕЛЬ (v10-стиль) ═══
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

Lampa.Noty.show('✅ Hermes v11 загружен!');

})();
