/**
 * Hermes Movie — автообновляемый плагин фильмов для Lampa
 * Version: 2.0.0
 * 
 * Установка: https://asimut.github.io/l/b.js
 * GitHub: https://github.com/Asimut/lampa-hermes-plugin
 * 
 * Появляется в главном меню как "🎬 Hermes Movie"
 */

(function() {
    'use strict';

    // ============ КОНФИГУРАЦИЯ ============
    var GITHUB_SOURCES_URL = 'https://raw.githubusercontent.com/Asimut/lampa-hermes-plugin/main/sources.json';
    var CACHE_KEY = 'hm_cache';
    var SOURCES_KEY = 'hm_sources';

    // Встроенные источники (если GitHub недоступен)
    var BUILTIN = [
        {id:'rezka',name:'HDRezka',url:'https://hdrezka.ag',search:'/engine/ajax/search.php',parser:'rezka'},
        {id:'filmix',name:'Filmix',url:'https://filmix.ac',search:'/api/v2/search',parser:'json'},
        {id:'kinogo',name:'Kinogo',url:'https://kinogo.zone',search:'/search',parser:'html'},
        {id:'anwap',name:'ANWAP',url:'https://anwap.love',search:'/api/v2/search',parser:'json'},
        {id:'uakino',name:'UAKino',url:'https://uakino.me',search:'/index.php?do=search',parser:'html'},
        {id:'uafix',name:'UAFix',url:'https://uafix.net',search:'/api/v1/search',parser:'json'},
        {id:'eneyida',name:'Eneyida',url:'https://eneyida.tv',search:'/index.php?do=search',parser:'html'},
        {id:'uafilm',name:'UAFilm',url:'https://uafilm.tv',search:'/index.php?do=search',parser:'html'},
        {id:'kinobase',name:'KinoBase',url:'https://kinobase.org',search:'/search',parser:'html'},
        {id:'videocdn',name:'VideoCDN',url:'https://videocdn.tv',search:'/api/short',parser:'json'}
    ];

    var sources = [];
    var lang = 'ru';

    // ============ ЛОГ ============
    function log(msg, type) {
        type = type || 'log';
        console[type]('[HM]', msg);
    }

    // ============ HTTP ============
    function httpGet(url, cb) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 8000;
        xhr.open('GET', url, true);
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0');
        xhr.onload = function() { cb(null, xhr.responseText, xhr); };
        xhr.onerror = function() { cb('error'); };
        xhr.ontimeout = function() { cb('timeout'); };
        xhr.send();
    }

    function httpPost(url, body, cb) {
        var xhr = new XMLHttpRequest();
        xhr.timeout = 8000;
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.onload = function() { cb(null, xhr.responseText, xhr); };
        xhr.onerror = function() { cb('error'); };
        xhr.ontimeout = function() { cb('timeout'); };
        xhr.send(body);
    }

    // ============ ЗАГРУЗКА ИСТОЧНИКОВ ============
    function loadSources(cb) {
        // Пробуем GitHub
        httpGet(GITHUB_SOURCES_URL, function(err, data) {
            if (!err && data) {
                try {
                    var json = JSON.parse(data);
                    if (json.sources && json.sources.length > 0) {
                        sources = json.sources;
                        localStorage.setItem(SOURCES_KEY, JSON.stringify({s: sources, t: Date.now()}));
                        log('Загружено с GitHub: ' + sources.length + ' источников');
                        cb(sources);
                        return;
                    }
                } catch(e) {}
            }

            // Пробуем кэш
            try {
                var cached = JSON.parse(localStorage.getItem(SOURCES_KEY) || '{}');
                if (cached.s && cached.s.length > 0 && (Date.now() - cached.t < 7*86400000)) {
                    sources = cached.s;
                    log('Загружено из кэша: ' + sources.length + ' источников');
                    cb(sources);
                    return;
                }
            } catch(e) {}

            // Встроенные
            sources = BUILTIN;
            log('Встроенные источники: ' + sources.length);
            cb(BUILTIN);
        });
    }

    // ============ ПОИСК ============
    function searchSource(src, query, cb) {
        var url, isPost = false, body;

        if (src.parser === 'rezka') {
            url = src.url + src.search;
            body = 'q=' + encodeURIComponent(query);
            isPost = true;
        } else {
            url = src.url + src.search;
            if (url.indexOf('?') >= 0) url += '&q=' + encodeURIComponent(query);
            else url += '?q=' + encodeURIComponent(query);
        }

        var fetch = isPost ? httpPost : httpGet;
        fetch(url, body || undefined, function(err, data) {
            if (err || !data) { cb([]); return; }

            var results = [];
            
            if (src.parser === 'json' || src.parser === 'rezka') {
                try {
                    var json = JSON.parse(data);
                    var items = Array.isArray(json) ? json : (json.data || json.results || json.items || json.posts || []);
                    items.slice(0, 10).forEach(function(item) {
                        results.push({
                            title: item.title || item.name || '',
                            year: item.year || '',
                            url: item.url || item.link || '',
                            poster: item.poster || item.image || '',
                            source: src.name
                        });
                    });
                } catch(e) {}
            }

            if (results.length === 0 && src.parser === 'html') {
                // Парсим ссылки из HTML
                var re = /<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
                var match, count = 0;
                var seen = {};
                while ((match = re.exec(data)) !== null && count < 10) {
                    var href = match[1];
                    var title = match[2].replace(/<[^>]+>/g, '').trim();
                    if (title.length > 3 && !seen[title]) {
                        seen[title] = true;
                        results.push({
                            title: title,
                            url: href.indexOf('http') === 0 ? href : src.url + href,
                            source: src.name
                        });
                        count++;
                    }
                }
            }

            cb(results);
        });
    }

    function searchAll(query, cb) {
        var allResults = [];
        var done = 0;
        var srcs = sources.length > 0 ? sources : BUILTIN;

        if (srcs.length === 0) { cb([]); return; }

        srcs.forEach(function(src) {
            searchSource(src, query, function(results) {
                done++;
                allResults = allResults.concat(results.map(function(r, i) {
                    return {id: src.id + '_' + i, title: r.title, year: r.year, url: r.url, poster: r.poster, source: src.name, data: r};
                }));
                
                if (done >= srcs.length) {
                    log('Найдено: ' + allResults.length);
                    cb(allResults);
                }
            });
        });
    }

    // ============ КОМПОНЕНТ ПОИСКА ============
    function HermesSearchComponent(obj) {
        var self = this;
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var html = $('<div></div>');

        this.create = function() {
            // Показываем поле ввода
            Lampa.Input.edit({
                free: true,
                nosave: true
            }, function(query) {
                if (query && query.trim()) {
                    self.doSearch(query.trim());
                } else {
                    Lampa.Controller.toggle('menu');
                }
            });
            return scroll.render();
        };

        this.doSearch = function(query) {
            Lampa.Loading.start();
            
            // Пробуем кэш
            try {
                var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
                var key = query.toLowerCase();
                if (cache[key] && (Date.now() - cache[key].t) < 2*3600000) {
                    Lampa.Loading.stop();
                    self.showResults(cache[key].r);
                    return;
                }
            } catch(e) {}

            // Ищем
            searchAll(query, function(results) {
                Lampa.Loading.stop();
                
                // Кэшируем
                try {
                    var cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
                    cache[query.toLowerCase()] = {r: results, t: Date.now()};
                    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                } catch(e) {}

                self.showResults(results);
            });
        };

        this.showResults = function(results) {
            html.empty();
            scroll.clear();
            scroll.reset();

            if (results.length === 0) {
                html.html('<div style="padding:40px;text-align:center;color:#888;font-size:16px;">Ничего не найдено</div>');
                scroll.append(html);
                Lampa.Controller.enable('content');
                return;
            }

            // Группируем по источнику
            var bySource = {};
            results.forEach(function(r) {
                var s = r.source || 'Другое';
                if (!bySource[s]) bySource[s] = [];
                bySource[s].push(r);
            });

            Object.keys(bySource).forEach(function(srcName) {
                var items = bySource[srcName];
                
                // Заголовок источника
                var header = $('<div style="padding:12px 20px 6px;color:#aaa;font-size:13px;font-weight:bold;">' + srcName + ' (' + items.length + ')</div>');
                html.append(header);

                // Карточки
                items.forEach(function(item) {
                    var card = Lampa.Template.get('card', {
                        id: item.id,
                        title: item.title,
                        img: item.poster || '',
                        release_date: item.year || ''
                    });

                    card.on('hover:enter', function() {
                        self.playItem(item);
                    });

                    html.append(card);
                });
            });

            scroll.append(html);
            Lampa.Controller.enable('content');
        };

        this.playItem = function(item) {
            if (item.url) {
                Lampa.Player.play({
                    url: item.url,
                    title: item.title,
                    movie: {title: item.title, id: item.id}
                });
            } else {
                Lampa.Noty.show('Нет ссылки для воспроизведения');
            }
        };

        this.destroy = function() {
            html.remove();
            scroll.destroy();
        };
    }

    // ============ ЗАПУСК ============
    function start() {
        log('Запуск v2.0.0');

        // Регистрируем компонент
        if (Lampa && Lampa.Component) {
            Lampa.Component.add('hermes_search', HermesSearchComponent);
            log('Компонент зарегистрирован');
        }

        // Добавляем кнопку в меню
        if (Lampa && Lampa.Menu) {
            Lampa.Menu.addButton('\uD83C\uDFAC', 'Hermes Movie', function() {
                Lampa.Activity.push({
                    url: '',
                    title: 'Hermes Movie',
                    component: 'hermes_search',
                    page: 1
                });
            });
            log('Кнопка меню добавлена');
        }

        // Загружаем источники
        loadSources(function(s) {
            log('Готово! Источников: ' + s.length);
        });

        // Экспорт в консоль
        window.HM = {
            search: function(q, cb) { searchAll(q, cb); },
            sources: function() { return sources; },
            reload: function() { loadSources(function(s) { log('Обновлено: ' + s.length); }); }
        };

        log('✅ Hermes Movie готов. Ищи \uD83C\uDFAC в меню!');
    }

    // Ждём Lampa
    if (window.appready) {
        start();
    } else if (Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') start();
        });
    } else {
        var tries = 0;
        var iv = setInterval(function() {
            tries++;
            if (window.appready || (Lampa && Lampa.Listener)) {
                clearInterval(iv);
                start();
            } else if (tries > 30) {
                clearInterval(iv);
                log('Lampa не найдена', 'error');
            }
        }, 1000);
    }
})();
