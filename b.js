/**
 * Hermes Movie v7 — плагин по аналогии с z01.online/live
 * Установка: https://asimut.github.io/l/b.js
 */
(function(){
'use strict';

// --- Источники ---
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

// --- HTTP (XMLHttpRequest, ES5) ---
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
    x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('err'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send(body);
}

// --- Парсеры ---
function parseJSON(text, baseUrl){
    try {
        var d = JSON.parse(text);
        var items = d.data || d.results || d.items || d.rows || d;
        if (!Array.isArray(items)) {
            var keys = Object.keys(items);
            for (var i = 0; i < keys.length; i++) {
                if (Array.isArray(items[keys[i]])) { items = items[keys[i]]; break; }
            }
        }
        if (!Array.isArray(items)) return [];
        var out = [];
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            out.push({
                title: it.title || it.name || '',
                url: it.url || it.link || (baseUrl + '/' + (it.id || it.slug || '')),
                year: it.year || ''
            });
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
            out.push({title: t, url: href, year: ''});
        }
    }
    return out;
}

function parseRezka(text, baseUrl){
    var re = /b-content__inline_item[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    var m, out = [];
    while ((m = re.exec(text)) !== null) {
        var href = m[1];
        if (href.indexOf('http') !== 0) href = baseUrl + href;
        out.push({title: m[2].trim(), url: href, year: ''});
    }
    return out.length > 0 ? out : parseHTML(text, baseUrl);
}

function searchSource(src, query, cb){
    var url, isPost = false, body;
    if (src.type === 'rezka') {
        url = src.url + src.search;
        body = 'q=' + encodeURIComponent(query);
        isPost = true;
    } else {
        url = src.url + src.search;
        var sep = url.indexOf('?') >= 0 ? '&' : '?';
        url += sep + 'q=' + encodeURIComponent(query);
    }
    var fn = isPost ? post : get;
    fn(url, body || undefined, function(err, data){
        if (err || !data) { cb([]); return; }
        if (src.type === 'json') cb(parseJSON(data, src.url));
        else if (src.type === 'rezka') cb(parseRezka(data, src.url));
        else cb(parseHTML(data, src.url));
    });
}

function searchAll(query, cb){
    var all = [], done = 0, total = SOURCES.length;
    for (var i = 0; i < total; i++) {
        searchSource(SOURCES[i], query, function(results){
            done++;
            if (results.length) all = all.concat(results);
            if (done >= total) {
                var seen = {}, uniq = [];
                for (var j = 0; j < all.length; j++) {
                    var k = all[j].title.toLowerCase().trim();
                    if (!seen[k]) { seen[k] = 1; uniq.push(all[j]); }
                }
                cb(uniq);
            }
        });
    }
}

function showResults(results, movieTitle){
    if (results.length === 0) {
        Lampa.Noty.show('Ничего не найдено');
        return;
    }
    var items = [];
    for (var i = 0; i < results.length; i++) {
        items.push({
            title: results[i].title + (results[i].year ? ' (' + results[i].year + ')' : ''),
            url: results[i].url
        });
    }
    Lampa.Select.show({
        title: 'Hermes: ' + movieTitle + ' (' + items.length + ')',
        items: items,
        onSelect: function(item){
            if (item.url) Lampa.Controls.open(item.url);
        }
    });
}

// ═══ КНОПКА — по аналогии с z01 ═══
// Шаблон кнопки (как у z01 — класс full-start__button selector)
var BUTTON_HTML = '<div class="full-start__button selector hermes-btn" style="background:linear-gradient(135deg,#667eea,#764ba2)">' +
    '<svg width="100" height="100" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="42" stroke="#fff" stroke-width="8" fill="none"/><path d="M35 25 L75 50 L35 75 Z" fill="#fff"/></svg>' +
    '<span>Hermes</span></div>';

function addButton(e){
    // z01: e.render.find('.lampac--button').length → проверяем, не добавлена ли уже
    if (e.render.find('.hermes-btn').length) return;

    var btn = $(BUTTON_HTML);

    btn.on('hover:enter', function(){
        var title = e.movie.title || e.movie.original_title || e.movie.name || '';
        if (!title) { Lampa.Noty.show('Название не найдено'); return; }

        Lampa.Noty.show('Ищу: ' + title + '...');
        Lampa.Loading.start();

        searchAll(title, function(results){
            Lampa.Loading.stop();
            showResults(results, title);
        });
    });

    // z01: e.render.after(btn) — добавляем ПОСЛЕ torrent-view
    e.render.after(btn);
}

// ═══ ИНИЦИАЛИЗАЦИЯ — точь-в-точь как z01 ═══
Lampa.Listener.follow('full', function(e){
    if (e.type === 'complite') {
        addButton({
            render: e.object.activity.render().find('.view--torrent'),
            movie: e.data.movie
        });
    }
});

// Если уже на странице фильма
try {
    if (Lampa.Activity.active().component === 'full') {
        addButton({
            render: Lampa.Activity.active().activity.render().find('.view--torrent'),
            movie: Lampa.Activity.active().card
        });
    }
} catch(e) {}

// Уведомление о загрузке
Lampa.Noty.show('✅ Hermes Movie v7 загружен!', 2500);

})();
