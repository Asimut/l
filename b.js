/**
 * Hermes Movie v6 — плагин поиска фильмов для Lampa
 * Установка: https://asimut.github.io/l/b.js  (GitHub Pages, НЕ raw!)
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
    {id:'uafilm',  name:'UAFilm',   url:'https://uafilm.tv',   search:'/index.php?do=search',            type:'html'},
    {id:'kinobase',name:'KinoBase', url:'https://kinobase.org',search:'/search',                         type:'html'},
    {id:'videocdn',name:'VideoCDN', url:'https://videocdn.tv', search:'/api/short',                     type:'json'}
];

// --- HTTP ---
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

// --- Поиск ---
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

// --- UI ---
function addSearchButton(movieTitle){
    // Ищем контейнер — разные версии Lampa
    var container = document.querySelector('.full-start__buttons, .full__buttons, .movie__buttons, .view--full .button.selector');
    if (!container) {
        setTimeout(function(){ addSearchButton(movieTitle); }, 500);
        return;
    }
    if (document.querySelector('.hm-search-btn')) return;

    var btn = document.createElement('div');
    btn.className = 'button hm-search-btn';
    btn.textContent = '🔍 Поиск (Hermes)';
    btn.setAttribute('data-background', '#764ba2');
    btn.style.cssText = 'background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;margin:5px;padding:10px 15px;border-radius:8px;text-align:center;font-weight:bold;cursor:pointer;';

    // Lampa использует jQuery-подобные события через свою систему
    if (typeof $ !== 'undefined') {
        $(btn).on('hover:enter', function(){
            Lampa.Noty.show('Ищу: ' + movieTitle + '...');
            Lampa.Loading.start();
            searchAll(movieTitle, function(results){
                Lampa.Loading.stop();
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
                        if (item.url) {
                            Lampa.Controls.open(item.url);
                        }
                    }
                });
            });
        });
    } else {
        // Fallback: обычный onclick
        btn.addEventListener('click', function(){
            Lampa.Noty.show('Ищу: ' + movieTitle + '...');
            Lampa.Loading.start();
            searchAll(movieTitle, function(results){
                Lampa.Loading.stop();
                showResultsFallback(results, movieTitle);
            });
        });
    }

    container.appendChild(btn);
}

function showResultsFallback(results, movieTitle){
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

// --- Инициализация ---
function getMovieTitle(){
    var el = document.querySelector('.full__title, .movie__title, h1, .full-start__title, .entity__title');
    return el ? el.textContent.trim() : '';
}

function init(){
    // Уведомление о загрузке
    if (typeof Lampa !== 'undefined' && Lampa.Noty) {
        Lampa.Noty.show('✅ Hermes Movie v6 загружен!', 2500);
    }

    // Слушаем открытие страницы фильма
    if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('full', function(e){
            if (e.type !== 'complite') return;
            setTimeout(function(){
                var title = getMovieTitle();
                if (title) addSearchButton(title);
            }, 800);
        });
    }
}

// Старт
if (window.appready) {
    init();
} else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
    Lampa.Listener.follow('app', function(e){
        if (e.type === 'ready') init();
    });
} else {
    var tries = 0;
    var iv = setInterval(function(){
        tries++;
        if (window.appready || (typeof Lampa !== 'undefined' && Lampa.Listener)) {
            clearInterval(iv);
            init();
        } else if (tries > 30) {
            clearInterval(iv);
        }
    }, 1000);
}

})();
