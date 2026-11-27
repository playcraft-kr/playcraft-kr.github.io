/* PlayCraft: these games may only be played on zanycade.com. Embedding them on another site is not permitted. */
/* Playing needs a PlayCraft account: a game opened on its own goes to its PlayCraft page; inside a page with no signed-in player,
   the whole game area becomes one button that opens "Create account" on the PlayCraft page. */
(function(){var slug=(location.pathname.match(/\/games\/([^\/]+)\//)||[])[1]||'',to=location.origin+'/preview/#/game/'+slug,A=null;
 try{if(window.top===window.self){location.replace(to);return}A=window.parent.Account;if(A&&A.signedIn)return}catch(e){}
 try{window.stop()}catch(_){}
 document.documentElement.innerHTML='<body style="margin:0;height:100vh;background:#1d1b3a"><button id="pc-join" type="button" style="all:unset;box-sizing:border-box;cursor:pointer;width:100%;height:100%;display:grid;place-items:center;text-align:center;padding:20px;color:#fff;font:16px system-ui,sans-serif"><div><div style="font-size:56px;line-height:1">🔒</div><p style="font-size:26px;font-weight:800;margin:14px 0 6px">Sign in to play</p><p style="margin:0 0 22px;color:#cfd0ee">Tap anywhere to make a free account — or sign in if you have one.</p><span style="display:inline-block;background:#ffc23d;color:#1d1b3a;font-weight:900;font-size:20px;padding:14px 30px;border-radius:999px;box-shadow:0 5px 0 #c98a00">Create account / Sign in</span></div></button></body>';
 document.getElementById('pc-join').onclick=function(){try{if(A&&window.parent.location.origin===location.origin){window.parent.postMessage({pc:'signup',slug:slug},location.origin);return}}catch(e){}window.top.location.href=to};
})();
