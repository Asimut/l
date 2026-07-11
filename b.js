(function(){'use strict';
if(typeof Lampa!=='undefined'&&Lampa.Utils)Lampa.Utils.putScriptAsync(['https://raw.githubusercontent.com/Asimut/lampa-hermes-plugin/main/hermes-movie.js'],function(){console.log('[HM] OK')});
else{var r=0;var i=setInterval(function(){r++;if(typeof Lampa!=='undefined'&&Lampa.Utils){clearInterval(i);Lampa.Utils.putScriptAsync(['https://raw.githubusercontent.com/Asimut/lampa-hermes-plugin/main/hermes-movie.js'],function(){})}else if(r>=20)clearInterval(i)},1000)}
})();
