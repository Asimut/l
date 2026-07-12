/**
 * Hermes Movie v12 — полноценный поиск с выбором источника и воспроизведением
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

// --- HTTP ---
function get(url, cb){
    var x = new XMLHttpRequest();
    x.timeout = 15000;
    x.open('GET', url, true);
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send();
}

function post(url, body, cb){
    var x = new XMLHttpRequest();
    x.timeout = 15000;
    x.open('POST', url, true);
    x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send(body);
}

// --- Парсер страницы фильма (ищем ссылки на видео) ---
function extractVideoUrls(html, baseUrl){
    var urls = [];
    // Ищем прямые ссылки на видео
    var patterns = [
        /(https?:\/\/[^"'\s]+\.(?:mp4|m3u8|mkv|webm|avi)[^"'\s]*)/gi,
        /(https?:\/\/[^"'\s]*\/embed\/[^"'\s]*)/gi,
        /src=["'](https?:\/\/[^"']*(?:video|player|stream|play)[^"']*)["']/gi,
        /<iframe[^>]+src=["']([^"']+)["']/gi
    ];
    for (var p = 0; p < patterns.length; p++) {
        var m;
        while ((m = patterns[p].exec(html)) !== null) {
            var u = m[1];
            if (u.indexOf('http') === 0 && urls.indexOf(u) < 0) urls.push(u);
        }
    }
    return urls;
}

// --- Поиск в источнике ---
function searchSource(src, query, cb){
    if (src.type === 'rezka') {
        post(src.url + src.search, 'q=' + encodeURIComponent(query), function(err, data){
            if (err || !data) { cb([]); return; }
            cb(parseRezka(data, src.url));
        });
    } else if (src.type === 'json') {
        var url = src.url + src.search;
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(query);
        get(url, function(err, data){
            if (err || !data) { cb([]); return; }
            cb(parseJSON(data, src.url));
        });
    } else {
        var url2 = src.url + src.search;
        url2 += (url2.indexOf('?') >= 0 ? '&' : '?') + 'do=search&subaction=search&story=' + encodeURIComponent(query);
        get(url2, function(err, data){
            if (err || !data) { cb([]); return; }
            cb(parseHTML(data, src.url));
        });
    }
}

function parseJSON(text, baseUrl){
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
        for (var i = 0; i < items.length && i < 15; i++) {
            var it = items[i];
            out.push({
                title: it.title || it.name || '',
                url: it.url || it.link || (baseUrl + '/film/' + (it.id || it.slug || '')),
                year: it.year || ''
            });
        }
        return out;
    } catch(e) { return []; }
}

function parseHTML(text, baseUrl){
    var re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]{3,120})<\/a>/gi;
    var m, seen = {}, out = [];
    while ((m = re.exec(text)) !== null && out.length < 15) {
        var t = m[2].replace(/<[^>]+>/g, '').trim();
        if (t.length > 2 && !seen[t]) {
            seen[t] = 1;
            var href = m[1];
            if (href.indexOf('http') !== 0) href = baseUrl.replace(/\/$/, '') + (href.indexOf('/') === 0 ? '' : '/') + href;
            out.push({title: t, url: href, year: ''});
        }
    }
    return out;
}

function parseRezka(text, baseUrl){
    // Rezka возвращает HTML
    var out = [];
    var re = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    var m, seen = {};
    while ((m = re.exec(text)) !== null && out.length < 15) {
        var t = m[2].trim();
        if (t.length > 3 && !seen[t]) {
            seen[t] = 1;
            var href = m[1];
            if (href.indexOf('http') !== 0) href = baseUrl + href;
            out.push({title: t, url: href, year: ''});
        }
    }
    return out;
}

// --- Открыть страницу фильма и найти видео ---
function openMovie(url, title, cb){
    get(url, function(err, html){
        if (err || !html) { cb([]); return; }
        var videos = extractVideoUrls(html, url);
        cb(videos);
    });
}

// ═══ КНОПКА ═══
function addButton(render, movie){
    try {
        if (!render) return;
        if (render.find('.hermes-btn').length) return;

        var btn = $('<div class="full-start__button selector hermes-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)"><span>Hermes</span></div>');

        btn.on('hover:enter', function(){
            try {
                var title = movie ? (movie.title || movie.original_title || movie.name || '') : '';
                if (!title) { Lampa.Noty.show('Название не найдено'); return; }

                // Шаг 1: показываем список источников
                var srcItems = [];
                for (var i = 0; i < SOURCES.length; i++) {
                    srcItems.push({title: SOURCES[i].name, source: SOURCES[i]});
                }

                Lampa.Select.show({
                    title: 'Выбери источник: ' + title,
                    items: srcItems,
                    onSelect: function(sel){
                        Lampa.Select.close();
                        Lampa.Noty.show('Поиск в ' + sel.source.name + '...');

                        // Шаг 2: поиск в выбранном источнике
                        searchSource(sel.source, title, function(results){
                            if (!results || results.length === 0) {
                                Lampa.Noty.show('Ничего не найдено в ' + sel.source.name);
                                return;
                            }
                            // Шаг 3: показываем результаты
                            var items = [];
                            for (var i = 0; i < results.length; i++) {
                                items.push({
                                    title: results[i].title + (results[i].year ? ' (' + results[i].year + ')' : ''),
                                    url: results[i].url,
                                    sourceName: sel.source.name
                                });
                            }

                            Lampa.Select.show({
                                title: sel.source.name + ': ' + title,
                                items: items,
                                onSelect: function(item){
                                    Lampa.Select.close();
                                    Lampa.Noty.show('Загружаю: ' + item.title + '...');

                                    // Шаг 4: открываем страницу, ищем видео
                                    openMovie(item.url, item.title, function(videos){
                                        if (!videos || videos.length === 0) {
                                            // Если видео не найдено — пробуем открыть в браузере
                                            Lampa.Noty.show('Нет прямых ссылок. Открываю сайт...');
                                            try { window.open(item.url, '_blank'); } catch(e) {}
                                            return;
                                        }
                                        // Шаг 5: показываем найденные видео
                                        var vidItems = [];
                                        for (var i = 0; i < videos.length; i++) {
                                            vidItems.push({title: 'Видео ' + (i+1), url: videos[i]});
                                        }
                                        Lampa.Select.show({
                                            title: 'Видео: ' + item.title,
                                            items: vidItems,
                                            onSelect: function(vid){
                                                Lampa.Select.close();
                                                // Запускаем в плеере Lampa
                                                Lampa.Player.play({url: vid.url, title: item.title});
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    }
                });
            } catch(e) {
                Lampa.Noty.show('Ошибка: ' + (e.message || e));
            }
        });

        render.after(btn);
    } catch(e) {}
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

Lampa.Noty.show('✅ Hermes v12 загружен!');

})();
