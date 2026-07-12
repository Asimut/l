/**
 * Hermes Movie v5 — поиск фильмов через Lampa
 * Хостинг: GitHub Pages (application/javascript, не raw!)
 * Установка: https://asimut.github.io/l/b.js
 */
(function(){
'use strict';

// Джерела пошуку
var SOURCES = [
    {id:'rezka',    name:'HDRezka',  url:'https://hdrezka.ag',    search:'/engine/ajax/search.php', type:'rezka'},
    {id:'filmix',   name:'Filmix',   url:'https://filmix.ac',     search:'/api/v2/search',          type:'json'},
    {id:'kinogo',   name:'Kinogo',   url:'https://kinogo.zone',   search:'/search',                  type:'html'},
    {id:'uakino',   name:'UAKino',   url:'https://uakino.me',     search:'/index.php?do=search',     type:'html'},
    {id:'eneyida',  name:'Eneyida',  url:'https://eneyida.tv',    search:'/index.php?do=search',     type:'html'},
    {id:'uafilm',   name:'UAFilm',   url:'https://uafilm.tv',     search:'/index.php?do=search',     type:'html'},
    {id:'anwap',    name:'ANWAP',    url:'https://anwap.org',     search:'/search/',                 type:'html'}
];

function log(msg){
    try { console.log('[Hermes]', msg); } catch(e){}
}

// --- HTTP-запити (ES5, без fetch) ---
function httpGet(url, cb){
    var x = new XMLHttpRequest();
    x.timeout = 10000;
    x.open('GET', url, true);
    try { x.setRequestHeader('User-Agent', 'Mozilla/5.0'); } catch(e){}
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('network'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send();
}

function httpPost(url, body, cb){
    var x = new XMLHttpRequest();
    x.timeout = 10000;
    x.open('POST', url, true);
    try {
        x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        x.setRequestHeader('User-Agent', 'Mozilla/5.0');
    } catch(e){}
    x.onload  = function(){ cb(null, x.responseText); };
    x.onerror = function(){ cb('network'); };
    x.ontimeout = function(){ cb('timeout'); };
    x.send(body);
}

// --- Пошук в одному джерелі ---
function searchSource(src, query, cb){
    var url, isPost = false, body;

    if(src.type === 'rezka'){
        url = src.url + src.search;
        body = 'q=' + encodeURIComponent(query);
        isPost = true;
    } else {
        url = src.url + src.search;
        url += (url.indexOf('?') >= 0 ? '&' : '?') + 'q=' + encodeURIComponent(query);
    }

    var fn = isPost ? httpPost : httpGet;
    fn(url, body || undefined, function(err, data){
        if(err || !data){ cb([]); return; }
        var results = [];
        try {
            if(src.type === 'json' || src.type === 'rezka'){
                var json = JSON.parse(data);
                var items = Array.isArray(json) ? json : (json.data || json.results || json.items || []);
                for(var i = 0; i < Math.min(items.length, 8); i++){
                    var item = items[i];
                    var link = item.url || item.link || item.video || '';
                    if(link) results.push({title: item.title || item.name || 'Без названия', url: link, source: src.name});
                }
            }
        } catch(e){}
        if(results.length === 0 && src.type === 'html'){
            var re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
            var m, seen = {}, cnt = 0;
            while((m = re.exec(data)) !== null && cnt < 8){
                var t = m[2].replace(/<[^>]+>/g, '').trim();
                if(t.length > 3 && !seen[t]){
                    seen[t] = 1;
                    results.push({
                        title: t,
                        url: m[1].indexOf('http') === 0 ? m[1] : src.url + m[1],
                        source: src.name
                    });
                    cnt++;
                }
            }
        }
        cb(results);
    });
}

// --- Додає кнопку на сторінку фільму ---
function addButton(movie){
    if(typeof $ === 'undefined') return;

    // Не дублюємо
    if($('.hermes-search-btn').length > 0) return;
    if(!movie || !movie.title) return;

    var btn = $('<div class="button hermes-search-btn" style="margin:8px 0;padding:10px 15px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;color:#fff;text-align:center;cursor:pointer;font-weight:bold;">🔍 Искать через Hermes</div>');

    btn.on('hover:enter', function(){
        log('Поиск: ' + movie.title);
        if(typeof Lampa === 'undefined' || !Lampa.Loading) return;
        Lampa.Loading.start();

        var all = [], done = 0, total = SOURCES.length;
        for(var i = 0; i < total; i++){
            searchSource(SOURCES[i], movie.title, function(results){
                done++;
                if(results.length > 0) all = all.concat(results);
                if(done >= total){
                    Lampa.Loading.stop();
                    if(all.length > 0) showResults(all, movie);
                    else Lampa.Noty.show('Ничего не найдено');
                }
            });
        }
    });

    // Шукаємо контейнер для кнопок
    var target = $('.full-start__buttons, .full__buttons, .movie__buttons, .view--full .full__button');
    if(target.length > 0){
        target.append(btn);
        log('Кнопка додана');
    } else {
        // Сторінка ще не повністю завантажилась — пробуємо пізніше
        setTimeout(function(){ addButton(movie); }, 800);
    }
}

// --- Показує результати пошуку ---
function showResults(items, movie){
    if(typeof Lampa === 'undefined' || !Lampa.Select) return;

    var list = [];
    for(var i = 0; i < items.length; i++){
        list.push({
            title: (items[i].source ? items[i].source + ': ' : '') + (items[i].title || 'Без названия'),
            movie: movie,
            url: items[i].url,
            source: items[i].source
        });
    }

    Lampa.Select.show({
        title: 'Hermes: ' + movie.title + ' (' + list.length + ')',
        items: list,
        onSelect: function(item){
            if(item.url && Lampa.Player){
                Lampa.Player.play({url: item.url, title: item.title, movie: item.movie});
            }
        },
        onBack: function(){
            if(Lampa.Controller) Lampa.Controller.toggle('content');
        }
    });
}

// --- Очікуємо відкриття сторінки фільму ---
function init(){
    log('Ініціалізація v5...');
    if(typeof Lampa === 'undefined' || !Lampa.Listener){
        log('Lampa не знайдена, чекаємо...');
        var attempts = 0;
        var iv = setInterval(function(){
            attempts++;
            if(typeof Lampa !== 'undefined' && Lampa.Listener){
                clearInterval(iv);
                setupListener();
            } else if(attempts > 30){
                clearInterval(iv);
                log('Lampa не знайдена після 30 спроб');
            }
        }, 1000);
        return;
    }
    setupListener();
}

function setupListener(){
    log('Підключаємо слухач full...');
    Lampa.Listener.follow('full', function(e){
        if(e.type === 'complite' && e.data && e.data.movie){
            setTimeout(function(){
                addButton(e.data.movie);
            }, 600);
        }
    });
    log('✅ Hermes Movie v5 готов!');
}

// Старт
if(window.appready){
    init();
} else if(typeof Lampa !== 'undefined' && Lampa.Listener){
    Lampa.Listener.follow('app', function(e){
        if(e.type === 'ready') init();
    });
} else {
    // Чекаємо готовності
    var t = 0;
    var iv = setInterval(function(){
        t++;
        if(window.appready || (typeof Lampa !== 'undefined' && Lampa.Listener)){
            clearInterval(iv);
            init();
        } else if(t > 30){
            clearInterval(iv);
            log('Таймаут очікування Lampa');
        }
    }, 1000);
}

})();
