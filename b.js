/**
 * Hermes Movie — добавляет источники в онлайн-поиск Lampa
 * Не создаёт новых кнопок, работает через существующую кнопку "Смотреть"
 */
(function(){
'use strict';

// Источники (меняются через GitHub)
var SOURCES = [
    {id:'rezka',name:'HDRezka',url:'https://hdrezka.ag',search:'/engine/ajax/search.php',type:'rezka'},
    {id:'filmix',name:'Filmix',url:'https://filmix.ac',search:'/api/v2/search',type:'json'},
    {id:'kinogo',name:'Kinogo',url:'https://kinogo.zone',search:'/search',type:'html'},
    {id:'uakino',name:'UAKino',url:'https://uakino.me',search:'/index.php?do=search',type:'html'},
    {id:'uafix',name:'UAFix',url:'https://uafix.net',search:'/api/v1/search',type:'json'},
    {id:'eneyida',name:'Eneyida',url:'https://eneyida.tv',search:'/index.php?do=search',type:'html'},
    {id:'uafilm',name:'UAFilm',url:'https://uafilm.tv',search:'/index.php?do=search',type:'html'}
];

function log(m){console.log('[HM]',m);}

// HTTP запрос
function get(url,cb){
    var x=new XMLHttpRequest();
    x.timeout=8000;
    x.open('GET',url,true);
    x.setRequestHeader('User-Agent','Mozilla/5.0');
    x.onload=function(){cb(null,x.responseText);};
    x.onerror=function(){cb('err');};
    x.ontimeout=function(){cb('timeout');};
    x.send();
}

function post(url,body,cb){
    var x=new XMLHttpRequest();
    x.timeout=8000;
    x.open('POST',url,true);
    x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
    x.setRequestHeader('User-Agent','Mozilla/5.0');
    x.setRequestHeader('X-Requested-With','XMLHttpRequest');
    x.onload=function(){cb(null,x.responseText);};
    x.onerror=function(){cb('err');};
    x.ontimeout=function(){cb('timeout');};
    x.send(body);
}

function searchSource(src,query,cb){
    var url,isPost=false,body;
    if(src.type==='rezka'){
        url=src.url+src.search;
        body='q='+encodeURIComponent(query);
        isPost=true;
    }else{
        url=src.url+src.search;
        url+=(url.indexOf('?')>=0?'&':'?')+'q='+encodeURIComponent(query);
    }
    var f=isPost?post:get;
    f(url,body||undefined,function(err,data){
        if(err||!data){cb([]);return;}
        var results=[];
        // JSON парсер
        if(src.type==='json'||src.type==='rezka'){
            try{
                var json=JSON.parse(data);
                var items=Array.isArray(json)?json:(json.data||json.results||json.items||[]);
                items.slice(0,8).forEach(function(item){
                    var link=item.url||item.link||item.video||'';
                    if(link) results.push({title:item.title||item.name||'',url:link,source:src.name});
                });
            }catch(e){}
        }
        // HTML парсер
        if(results.length===0&&src.type==='html'){
            var re=/<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})<\/a>/gi;
            var m,seen={},cnt=0;
            while((m=re.exec(data))!==null&&cnt<8){
                var t=m[2].replace(/<[^>]+>/g,'').trim();
                if(t.length>3&&!seen[t]){seen[t]=1;results.push({title:t,url:m[1].indexOf('http')===0?m[1]:src.url+m[1],source:src.name});cnt++;}
            }
        }
        cb(results);
    });
}

// === ИНТЕГРАЦИЯ В LAMPA ===
// Когда пользователь ищет фильм в разделе "Онлайн" — добавляем наши результаты
function injectSources(){
    log('Инжектируем источники...');

    // Патчим отображение онлайн-результатов — добавляем туда наши ссылки
    if(Lampa&&Lampa.Listener){
        Lampa.Listener.follow('full',function(e){
            if(e.type==='complite'){
                // Добавляем кнопку поиска через наши источники
                setTimeout(function(){
                    addHermesButton(e);
                },500);
            }
        });
        log('Слушатель full добавлен');
    }
}

function addHermesButton(e){
    // Проверяем что уже не добавили
    if($('.hermes-online-btn').length>0) return;

    var movie=e.data.movie;
    if(!movie||!movie.title) return;

    var btn=$('<div class="button hermes-online-btn" style="margin:8px 0;padding:10px 15px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:8px;color:#fff;text-align:center;cursor:pointer;font-weight:bold;">🔍 Искать через Hermes</div>');

    btn.on('hover:enter',function(){
        log('Поиск: '+movie.title);
        Lampa.Loading.start();

        var all=[],done=0;
        SOURCES.forEach(function(src){
            searchSource(src,movie.title,function(results){
                done++;
                if(results.length>0) all=all.concat(results);
                if(done>=SOURCES.length){
                    Lampa.Loading.stop();
                    if(all.length>0){
                        showHermesResults(all,movie);
                    }else{
                        Lampa.Noty.show('Ничего не найдено');
                    }
                }
            });
        });
    });

    // Вставляем после кнопки "Смотреть онлайн"
    var target=$('.full-start__buttons, .full__buttons, .movie__buttons');
    if(target.length>0){
        target.append(btn);
    }else{
        // Ждём ещё
        setTimeout(function(){addHermesButton(e);},1000);
    }
}

function showHermesResults(items,movie){
    Lampa.Select.show({
        title:'Hermes: '+movie.title+' ('+items.length+')',
        items:items.map(function(item){
            return {
                title:(item.source?item.source+': ':'')+(item.title||'Без названия'),
                movie:movie,
                url:item.url,
                source:item.source
            };
        }),
        onSelect:function(item){
            if(item.url){
                Lampa.Player.play({url:item.url,title:item.title,movie:movie});
            }
        },
        onBack:function(){
            Lampa.Controller.toggle('content');
        }
    });
}

// === ЗАПУСК ===
function start(){
    log('Запуск...');
    injectSources();
    log('✅ Готово! Открой любой фильм → появится кнопка "🔍 Искать через Hermes"');
}

// Ждём Lampa
if(window.appready) start();
else if(Lampa&&Lampa.Listener) Lampa.Listener.follow('app',function(e){if(e.type==='ready')start();});
else {
    var t=0;
    var iv=setInterval(function(){
        t++;
        if(window.appready||(Lampa&&Lampa.Listener)){clearInterval(iv);start();}
        else if(t>30){clearInterval(iv);log('Не удалось найти Lampa','warn');}
    },1000);
}

})();
