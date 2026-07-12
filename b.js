/**
 * Hermes Movie v5 — однофайловый плагин поиска фильмов для Lampa.
 * Установка: https://raw.githubusercontent.com/Asimut/l/main/b.js
 * 
 * Фичи:
 * - Кнопка "🔍 Поиск" на странице фильма
 * - Поиск по 10 источникам (HDRezka, Filmix, Kinogo, ANWAP, UAKino, UAFix, Eneyida, UAFilm, KinoBase, VideoCDN)
 * - Результаты через Lampa.Select.show
 * - Чистый ES5 (совместимость с WebOS/Tizen)
 * - XMLHttpRequest вместо fetch
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════
    // Источники (вшиты в код, автообновление — позже)
    // ═══════════════════════════════════════════
    var SOURCES = [
        {id:'rezka',   name:'HDRezka',  url:'https://hdrezka.ag',  search:'/engine/ajax/search.php',        lang:'ru', parser:'rezka'},
        {id:'filmix',  name:'Filmix',   url:'https://filmix.ac',   search:'/api/v2/search',                 lang:'ru', parser:'json'},
        {id:'kinogo',  name:'Kinogo',   url:'https://kinogo.zone', search:'/search',                         lang:'ru', parser:'html'},
        {id:'anwap',   name:'ANWAP',    url:'https://anwap.love',  search:'/api/v2/search',                 lang:'ru', parser:'json'},
        {id:'uakino',  name:'UAKino',   url:'https://uakino.me',   search:'/index.php?do=search',            lang:'uk', parser:'html'},
        {id:'uafix',   name:'UAFix',    url:'https://uafix.net',   search:'/api/v1/search',                 lang:'uk', parser:'json'},
        {id:'eneyida', name:'Eneyida',  url:'https://eneyida.tv',  search:'/index.php?do=search',            lang:'uk', parser:'html'},
        {id:'uafilm',  name:'UAFilm',   url:'https://uafilm.tv',   search:'/index.php?do=search',            lang:'uk', parser:'html'},
        {id:'kinobase',name:'KinoBase', url:'https://kinobase.org',search:'/search',                         lang:'ru', parser:'html'},
        {id:'videocdn',name:'VideoCDN', url:'https://videocdn.tv', search:'/api/short',                     lang:'ru', parser:'json'}
    ];

    // ═══════════════════════════════════════════
    // HTTP-клиент (XMLHttpRequest, ES5)
    // ═══════════════════════════════════════════
    function httpGet(url, callback, timeout) {
        timeout = timeout || 10000;
        var xhr = new XMLHttpRequest();
        var done = false;
        var timer = setTimeout(function() {
            if (!done) { done = true; xhr.abort(); callback('timeout', null); }
        }, timeout);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && !done) {
                done = true;
                clearTimeout(timer);
                if (xhr.status >= 200 && xhr.status < 400) {
                    callback(null, xhr.responseText);
                } else {
                    callback('HTTP ' + xhr.status, null);
                }
            }
        };
        xhr.onerror = function() {
            if (!done) { done = true; clearTimeout(timer); callback('network error', null); }
        };
        xhr.open('GET', url, true);
        xhr.timeout = timeout;
        xhr.send();
    }

    function httpPost(url, body, callback, timeout) {
        timeout = timeout || 10000;
        var xhr = new XMLHttpRequest();
        var done = false;
        var timer = setTimeout(function() {
            if (!done) { done = true; xhr.abort(); callback('timeout', null); }
        }, timeout);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && !done) {
                done = true;
                clearTimeout(timer);
                if (xhr.status >= 200 && xhr.status < 400) {
                    callback(null, xhr.responseText);
                } else {
                    callback('HTTP ' + xhr.status, null);
                }
            }
        };
        xhr.onerror = function() {
            if (!done) { done = true; clearTimeout(timer); callback('network error', null); }
        };
        xhr.open('POST', url, true);
        xhr.timeout = timeout;
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.send(body);
    }

    // ═══════════════════════════════════════════
    // Парсеры результатов
    // ═══════════════════════════════════════════

    // JSON-парсер: ищет data/results/items/rows
    function parseJSON(text, sourceUrl) {
        try {
            var data = JSON.parse(text);
            var items = data.data || data.results || data.items || data.rows || data;
            if (!Array.isArray && items && typeof items === 'object') {
                // Попробуем найти массив внутри
                var keys = Object.keys(items);
                for (var i = 0; i < keys.length; i++) {
                    if (Array.isArray(items[keys[i]])) { items = items[keys[i]]; break; }
                }
            }
            if (!Array.isArray(items)) return [];
            return items.map(function(item) {
                return {
                    title: item.title || item.name || item.original_title || item.original_name || 'Без названия',
                    url: item.url || item.link || (sourceUrl + '/film/' + (item.id || item.slug || '')),
                    poster: item.poster || item.poster_path || item.image || item.img || '',
                    year: item.year || item.release_date || '',
                    quality: item.quality || item.rating || ''
                };
            });
        } catch(e) {
            return [];
        }
    }

    // HTML-парсер: regex по ссылкам и заголовкам
    function parseHTML(text, sourceUrl) {
        var results = [];
        // Ищем ссылки вида <a href="...">Название</a>
        var linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        var match;
        while ((match = linkRe.exec(text)) !== null) {
            var href = match[1];
            var title = match[2].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
            if (!title || title.length < 2) continue;
            // Исключаем навигационные ссылки
            if (/^(главная|вход|регистрация|новинки|жанры|годы|страны|поиск|login|home|next|prev)/i.test(title)) continue;
            // Нормализуем URL
            if (href.indexOf('http') !== 0) {
                href = sourceUrl.replace(/\/$/, '') + (href.indexOf('/') === 0 ? '' : '/') + href;
            }
            results.push({title: title, url: href, poster: '', year: '', quality: ''});
        }
        return results.slice(0, 30);
    }

    // HDRezka парсер (специфичный ответ POST)
    function parseRezka(text, sourceUrl) {
        var results = [];
        // Ответ Rezka — HTML с классом b-content__inline_item
        var itemRe = /b-content__inline_item[^>]*>([\s\S]*?)<\/li>/gi;
        var match;
        while ((match = itemRe.exec(text)) !== null) {
            var block = match[1];
            var hrefMatch = /<a[^>]+href=["']([^"']+)["']/.exec(block);
            var titleMatch = />([^<]+)<\/a>/.exec(block);
            if (hrefMatch && titleMatch) {
                var href = hrefMatch[1];
                if (href.indexOf('http') !== 0) href = sourceUrl + href;
                results.push({
                    title: titleMatch[1].trim(),
                    url: href,
                    poster: '',
                    year: '',
                    quality: ''
                });
            }
        }
        return results.length > 0 ? results : parseHTML(text, sourceUrl);
    }

    // ═══════════════════════════════════════════
    // Поиск по одному источнику
    // ═══════════════════════════════════════════
    function searchSource(source, query, callback) {
        var baseUrl = source.url.replace(/\/$/, '');
        var searchPath = source.search;

        if (source.parser === 'rezka') {
            // HDRezka: POST /engine/ajax/search.php с body q=QUERY
            var postUrl = baseUrl + searchPath;
            var body = 'q=' + encodeURIComponent(query);
            httpPost(postUrl, body, function(err, text) {
                if (err) { callback([]); return; }
                callback(parseRezka(text, baseUrl));
            });
        } else {
            // GET-запрос для остальных
            var getUrl = baseUrl + searchPath;
            // Добавляем query parameter
            var sep = getUrl.indexOf('?') >= 0 ? '&' : '?';
            if (source.parser === 'json') {
                getUrl = getUrl + sep + 'q=' + encodeURIComponent(query) + '&keyword=' + encodeURIComponent(query);
            } else {
                getUrl = getUrl + sep + 'do=search&subaction=search&story=' + encodeURIComponent(query);
            }
            httpGet(getUrl, function(err, text) {
                if (err) { callback([]); return; }
                if (source.parser === 'json') {
                    callback(parseJSON(text, baseUrl));
                } else {
                    callback(parseHTML(text, baseUrl));
                }
            });
        }
    }

    // ═══════════════════════════════════════════
    // Поиск по всем источникам (параллельно)
    // ═══════════════════════════════════════════
    function searchAll(query, callback) {
        var total = SOURCES.length;
        var done = 0;
        var allResults = [];

        function onSourceDone(sourceResults) {
            allResults = allResults.concat(sourceResults);
            done++;
            if (done >= total) {
                // Убираем дубликаты по названию
                var seen = {};
                var unique = [];
                for (var i = 0; i < allResults.length; i++) {
                    var key = allResults[i].title.toLowerCase().trim();
                    if (!seen[key]) {
                        seen[key] = true;
                        unique.push(allResults[i]);
                    }
                }
                callback(unique);
            }
        }

        for (var i = 0; i < total; i++) {
            searchSource(SOURCES[i], query, onSourceDone);
        }
    }

    // ═══════════════════════════════════════════
    // Показать результаты через Lampa.Select.show
    // ═══════════════════════════════════════════
    function showResults(results, movieTitle) {
        if (!results || results.length === 0) {
            Lampa.Noty.show('Ничего не найдено по запросу: ' + movieTitle);
            return;
        }

        var items = [];
        for (var i = 0; i < results.length; i++) {
            (function(result) {
                var label = result.title;
                if (result.year) label += ' (' + result.year + ')';
                if (result.quality) label += ' [' + result.quality + ']';
                items.push({
                    title: label,
                    movie: result,
                    poster: result.poster || ''
                });
            })(results[i]);
        }

        Lampa.Select.show({
            title: 'Результаты поиска: ' + movieTitle + ' (' + results.length + ')',
            items: items,
            onSelect: function(item) {
                // Открываем ссылку на источник
                if (item.movie && item.movie.url) {
                    Lampa.Noty.show('Открываю: ' + item.movie.title);
                    // Пробуем открыть URL (если Lampa поддерживает внешние ссылки)
                    if (Lampa.Activity && Lampa.Activity.push) {
                        Lampa.Activity.push({
                            url: item.movie.url,
                            title: item.movie.title,
                            component: 'online',
                            page: 1
                        });
                    }
                }
            }
        });
    }

    // ═══════════════════════════════════════════
    // Добавление кнопки на страницу фильма
    // ═══════════════════════════════════════════
    function addButton() {
        Lampa.Listener.follow('full', function(e) {
            if (e.type !== 'complite') return;

            // Ждём появления кнопок
            setTimeout(function() {
                var containers = document.querySelectorAll('.full-start__buttons, .full__buttons, .movie__buttons');
                if (!containers || containers.length === 0) return;

                // Проверяем, не добавлена ли уже кнопка
                var existing = document.querySelector('.hermes-search-btn');
                if (existing) return;

                var btn = document.createElement('div');
                btn.className = 'button hermes-search-btn';
                btn.textContent = '🔍 Поиск';
                btn.style.cssText = 'background:#c94d4d;color:#fff;margin:0 5px;';

                btn.addEventListener('hover:enter', function() {
                    // Получаем название фильма со страницы
                    var titleEl = document.querySelector('.full__title, .movie__title, h1, .full-start__title');
                    var movieTitle = titleEl ? titleEl.textContent.trim() : '';

                    if (!movieTitle) {
                        Lampa.Noty.show('Не удалось определить название фильма');
                        return;
                    }

                    Lampa.Noty.show('Ищу: ' + movieTitle + ' по 10 источникам...');
                    Lampa.Loading.start();

                    searchAll(movieTitle, function(results) {
                        Lampa.Loading.stop();
                        showResults(results, movieTitle);
                    });
                });

                containers[0].appendChild(btn);
            }, 500);
        });
    }

    // ═══════════════════════════════════════════
    // Инициализация (трёхступенчатая защита)
    // ═══════════════════════════════════════════
    function start() {
        console.log('[HermesMovie v5] Init');
        addButton();
    }

    // Этап 1: Lampa уже готов
    if (window.appready) {
        start();
    }
    // Этап 2: ждём событие 'app ready'
    else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') start();
        });
    }
    // Этап 3: таймер-защита
    else {
        var tries = 0;
        var iv = setInterval(function() {
            tries++;
            if (window.appready || (typeof Lampa !== 'undefined' && Lampa.Listener)) {
                clearInterval(iv);
                start();
            } else if (tries > 30) {
                clearInterval(iv);
                console.error('[HermesMovie v5] Lampa not found after 30s');
            }
        }, 1000);
    }

})();
