# react-native-pomelo

[Pomelo](https://github.com/NetEase/pomelo) 在 React-Native WebSocket 的精简封装。 参考 [pomelo-cocos2d-js](https://github.com/NetEase/pomelo-cocos2d-js) 

服务器使用 WebSocket 版本   [chatofpomelo-websocket](https://github.com/NetEase/chatofpomelo-websocket)

需要添加protobuf压缩的   [pomelo-protobuf](https://github.com/pomelonode/pomelo-protobuf)

```
npm install react-native-pomelo --save
```

```
import Pomelo from 'react-native-pomelo';
```


一个栗子
```

import Pomelo from 'react-native-pomelo';
let uid = "uid";
let rid = "rid";
let username = "username";

Pomelo.init({
	host: "127.0.0.1",
	port: 3014,
	log: true
}, function() {
	Pomelo.request('gate.gateHandler.queryEntry', {
		uid: uid
	}, function(data) {
		Pomelo.disconnect();
		Pomelo.init({
			host: data.host,
			port: data.port,
			log: true
		}, function() {
			Pomelo.request("connector.entryHandler.enter", {
				username: username,
				rid: rid
			}, function(data) {
				chatSend();
			});
		});
	});
});

function chatSend() {
	let target = "*";
	let msg = "msg"
	Pomelo.request("chat.chatHandler.send", {
		rid: rid,
		content: msg,
		from: username,
		target: target
	}, function(data) {
        console.log( data );
	});
}


```

## License

(The MIT License)

Copyright (c) 2016-2018 NetEase, Inc. and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
