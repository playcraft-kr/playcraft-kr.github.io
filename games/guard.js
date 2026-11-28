/* Zanycade: these games may only be played on zanycade.com. Embedding them on another site is not permitted. */
/* Playing needs a Zanycade account: a game opened on its own goes to its Zanycade page; inside a page with no signed-in player,
   the whole game area becomes one button that opens "Create account" on the Zanycade page. */
(function(){var slug=(location.pathname.match(/\/games\/([^\/]+)\//)||[])[1]||'',to=location.origin+'/#/game/'+slug,A=null;
 try{if(window.top===window.self){location.replace(to);return}A=window.parent.Account;if(A&&A.signedIn)return}catch(e){}
 try{window.stop()}catch(_){}
 document.documentElement.innerHTML='<body style="margin:0;height:100vh;background:#1d1b3a"><button id="pc-join" type="button" style="all:unset;box-sizing:border-box;cursor:pointer;width:100%;height:100%;display:grid;place-items:center;text-align:center;padding:20px;color:#fff;font:16px system-ui,sans-serif"><div><div style="font-size:56px;line-height:1">🔒</div><p style="font-size:26px;font-weight:800;margin:14px 0 6px">Sign in to play</p><p style="margin:0 0 22px;color:#cfd0ee">Tap anywhere to make a free account — or sign in if you have one.</p><span style="display:inline-block;background:#ffc23d;color:#1d1b3a;font-weight:900;font-size:20px;padding:14px 30px;border-radius:999px;box-shadow:0 5px 0 #c98a00">Create account / Sign in</span></div></button></body>';
 document.getElementById('pc-join').onclick=function(){try{if(A&&window.parent.location.origin===location.origin){window.parent.postMessage({pc:'signup',slug:slug},location.origin);return}}catch(e){}window.top.location.href=to};
})();
/* Zanycade: even line breaks in every game. A short message breaks into lines of about the same length
   ("You stacked 10 floors. / Your best is 12.") instead of leaving one or two words alone on the last line.
   It is inherited, so a game that sets its own text-wrap keeps it. Also given to the game's own inner frames. */
(function(){var css='html{text-wrap-style:balance}input,textarea,pre,code{text-wrap-style:auto}';
 function put(d){try{if(!d||d.getElementById('zc-wrap'))return;var s=d.createElement('style');s.id='zc-wrap';s.textContent=css;(d.head||d.documentElement).insertBefore(s,(d.head||d.documentElement).firstChild)}catch(e){}}
 function frames(d){try{var f=d.getElementsByTagName('iframe');for(var i=0;i<f.length;i++)hook(f[i])}catch(e){}}
 function hook(f){if(f.__zcw)return;f.__zcw=1;var go=function(){try{put(f.contentDocument);frames(f.contentDocument);watch(f.contentDocument)}catch(e){}};f.addEventListener('load',go);go()}
 function watch(d){try{if(!d||d.__zcw)return;d.__zcw=1;new MutationObserver(function(){frames(d)}).observe(d.documentElement,{childList:true,subtree:true})}catch(e){}}
 put(document);watch(document);
})();
