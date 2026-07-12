/**
 * Hermes Movie v13 — поиск без парсинга страниц (CORS на ТВ блокирует)
 * Установка: https://asimut.github.io/l/b.js
 */
(function(){
'use strict';

var SOURCES = [
    {id:'rezka',   name:'HDRezka',  url:'https://hdrezka.ag',  search:'/engine/ajax/search.php',        type:'rezka'},
    {id:'filmix',  name:'Filmix',   url:'https://filmix.ac',   search:'/api/v2/search',                 type:'json'},
    {id:'kinogo',  name:'Kinogo',   url:'https://kinogo.zone', search:'/index.php?do=search',            type:'html'},
    {id:'anwap',   name:'ANWAP',    url:'https://anwap.love',  search:'/api/v2/search',                 type:'json'},
    {id:'uakino',  name:'UAKino',   url:'https://uakino.me',   search:'/index.php?do=search',            type:'html'},
    {id:'eneyida', name:'Eneyida',  url:'https://eneyida.tv',  search:'/index.php?do=search',            type:'html'},
    {id:'uafilm',  name:'UAFilm',   url:'https://uafilm.tv',   search:'/index.php?do=search',            type:'html'}
];

function get(url, cb){
    var x = new XMLHttpRequest();
    x.timeout = 8000;
    x.open('GET', url, true);
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send();
}

function post(url, body, cb){
    var x = new XMLHttpRequest();
    x.timeout = 8000;
    x.open('POST', url, true);
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send(body);
}

function parseResults(text, src){
    try {
        var d = JSON.parse(text);
        var items = d.data || d.results || d.items || d.rows || d;
        if (items && typeof items === 'object' && !(items instanceof Array)) {
            var keys = Object.keys(items);
            for (var i = 0; i < keys.length; i++) {
                if (items[keys[i]] instanceof Array) { items = items[keys[i]]; break; }
            }
        }
        if (!(items instanceof Array)) return [];
        var out = [];
        for (var i = 0; i < items.length && i < 10; i++) {
            var it = items[i];
            out.push({
                title: it.title || it.name || '',
                url: it.url || it.link || (src.url + '/' + (it.id || it.slug || '')),
                source: src.name
            });
        }
        return out;
    } catch(e) { return []; }
}

function parseHTML(text, src){
    var re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{3,120})<\/a>/gi;
    var m, seen = {}, out = [];
    while ((m = re.exec(text)) !== null && out.length < 10) {
        var t = m[2].replace(/<[^>]+>/g, '').trim();
        if (t.length > 3 && !seen[t]) {
            seen[t] = 1;
            var href = m[1];
            if (href.indexOf('http') !== 0) href = src.url.replace(/\/$/, '') + '/' + href.replace(/^\//, '');
            out.push({title: t, url: href, source: src.name});
        }
    }
    return out;
}

function searchOne(src, query, cb){
    if (src.type === 'rezka') {
        post(src.url + src.search, 'q=' + encodeURIComponent(query), function(err, data){
            if (err || !data) { cb(null, 'Ошибка сети'); return; }
            var r = parseResults(data, src);
            if (r.length === 0) r = parseHTML(data, src);
            cb(r, null);
        });
    } else {
        var url = src.url + src.search;
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(query);
        get(url, function(err, data){
            if (err || !data) { cb(null, 'Ошибка сети'); return; }
            if (src.type === 'json') cb(parseResults(data, src), null);
            else cb(parseHTML(data, src), null);
        });
    }
}

// ═══ UI ═══
function addButton(render, movie){
    try {
        if (!render) return;
        if (render.find('.hermes-btn').length) return;

        var btn = $('<div class="full-start__button selector hermes-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)"><span>Hermes</span></div>');

        btn.on('hover:enter', function(){
            try {
                var title = movie ? (movie.title || movie.original_title || movie.name || '') : '';
                if (!title) { Lampa.Noty.show('Нет названия'); return; }

                // Шаг 1: список источников
                var srcItems = [];
                for (var i = 0; i < SOURCES.length; i++) {
                    srcItems.push({title: SOURCES[i].name, src: SOURCES[i]});
                }
                srcItems.push({title: '🔍 Искать везде', src: null});

                Lampa.Select.show({
                    title: 'Hermes: ' + title,
                    items: srcItems,
                    onSelect: function(sel){
                        Lampa.Select.close();
                        if (!sel.src) {
                            // Искать везде
                            searchAll(title);
                            return;
                        }
                        // Искать в одном источнике
                        Lampa.Noty.show(sel.src.name + ': поиск...');
                        searchOne(sel.src, title, function(results, err){
                            if (err || !results || results.length === 0) {
                                Lampa.Noty.show(sel.src.name + ': ничего не найдено');
                                return;
                            }
                            showResults(results, sel.src.name + ': ' + title);
                        });
                    }
                });
            } catch(e) {
                Lampa.Noty.show('Ошибка: ' + (e.message || ''));
            }
        });

        render.after(btn);
    } catch(e) {}
}

function searchAll(title){
    var srcResults = [];
    var done = 0, total = SOURCES.length;

    for (var i = 0; i < total; i++) {
        searchOne(SOURCES[i], title, function(results, err){
            done++;
            if (results && results.length) {
                srcResults.push({source: results[0].source, count: results.length, results: results});
            }
            if (done >= total) {
                if (srcResults.length === 0) {
                    Lampa.Noty.show('Ничего не найдено');
                    return;
                }
                // Группируем по источникам
                var items = [];
                for (var j = 0; j < srcResults.length; j++) {
                    var sr = srcResults[j];
                    for (var k = 0; k < sr.results.length; k++) {
                        items.push({
                            title: '[' + sr.source + '] ' + sr.results[k].title,
                            url: sr.results[k].url
                        });
                    }
                }
                showResults(items, 'Везде: ' + title);
            }
        });
    }
}

function showResults(items, theTitle){
    if (!items || items.length === 0) {
        Lampa.Noty.show('Ничего не найдено');
        return;
    }
    Lampa.Select.show({
        title: theTitle + ' (' + items.length + ')',
        items: items,
        onSelect: function(item){
            Lampa.Select.close();
            if (item.url) {
                // Пробуем открыть в плеере если прямая ссылка на видео
                if (/\.(mp4|m3u8|mkv|webm)(\?|$)/i.test(item.url)) {
                    Lampa.Player.play({url: item.url, title: item.title});
                } else {
                    // Иначе открываем сайт
                    Lampa.Noty.show('Открываю: ' + item.title);
                    try { window.open(item.url, '_blank'); } catch(e) {}
                }
            }
        }
    });
}

// ═══ СЛУШАТЕЛЬ ═══
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

Lampa.Noty.show('✅ Hermes v13 загружен!');

})();
