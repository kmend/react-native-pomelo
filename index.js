'use strict';
/**
 * Created by 陈桥 on 2016/6/30.
 * QQ:626164558
 * Email ：chen.qiao@foxmail.com
 */
var socket = null;

var reqId = 0;
var callbacks = {};
var routeMap = {};

var decode = null;
var encode = null;

var useCrypto;
var reconncetTimer = null;


var serverProtos = {};
var clientProtos = {};
var protoVersion = 0;

var nextHeartbeatTimeout = 0;
var JS_WS_CLIENT_TYPE = 'js-websocket';
var JS_WS_CLIENT_VERSION = '0.0.1';
var handlers = {};

import Protocol from './lib/protocol';
import EventEmitter from './lib/events';

var RES_OK = 200;           //数据返回正确
var RES_FAIL = 500;
var RES_OLD_CLIENT = 501;   //客户端版本错误

var heartbeatInterval = 0;              //心跳包间隔
var heartbeatTimeout = 0;               //最长断连时间
var nextHeartbeatTimeout = 0;
var gapThreshold = 100;
var heartbeatId = null;
var heartbeatTimeoutId = null;
var handshakeCallback = null;
var dict = {};                      // 服务器已支持所有路由地址词典
var abbrs = {};                     // 服务器已支持所有路由地址

var Package = Protocol.Package;
var Message = Protocol.Message;
var initCallback = null;

var reconnect = true;
var reconncetTimer = null;
var reconnectUrl = null;
var reconnectAttempts = 0;
var reconnectionDelay = 5000;
var DEFAULT_MAX_RECONNECT_ATTEMPTS = 1000;   //掉线重连次数，   reconnectionDelay * 2 * N   最大5分钟 重置以 5000 重连

var handshakeBuffer = {
    'sys': {
        type: JS_WS_CLIENT_TYPE,
        version: JS_WS_CLIENT_VERSION,
        rsa: {}
    },
    'user': {
    }
};

/**
 * 重置初始参数
 */
function reset() {
    reconnect = true;
    reconnectionDelay = 1000 * 5;
    reconnectAttempts = 0;
    clearTimeout(reconncetTimer);
};

/**
 * 连接WebSocket
 * @param params
 * @param url
 * @param cb
 */
function connect(params, url, cb){

    console.log( "connect ====================="  );

    params = params || {};
    reconnectUrl = url;
    handshakeBuffer.sys.protoVersion = protoVersion;
    var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;

    var onopen = function(event) {
        reset();
        var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer)));
        send(obj);                      //服务器第一次握手  发送版本信息
    };

    var onmessage = function(event) {

        processPackage(Package.decode(event.data), cb);
        if(heartbeatTimeout) {
            nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
        }

    };
    var onerror = function(event) {
        console.log('socket error: ');
    };
    var onclose = function(event) {
        console.log('socket close: ', reconnectAttempts < maxReconnectAttempts, reconnectionDelay);
        if(reconnect && reconnectAttempts < maxReconnectAttempts) {

            reconnectAttempts++;

            reconncetTimer = setTimeout(function() {
                connect(params, reconnectUrl, cb);
            }, reconnectionDelay);
            reconnectionDelay *= 2;

            if( reconnectionDelay > 5 * 60 * 60 * 1000){
                reconnectionDelay = 5000;
            }

        }
    };

    socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = onopen;
    socket.onmessage = onmessage;
    socket.onerror = onerror;
    socket.onclose = onclose;

}
/**
 * 心跳包头文件处理
 * @param data
 */
var handshakeInit = function(data) {

    if(data.sys && data.sys.heartbeat) {
        heartbeatInterval = data.sys.heartbeat * 1000;   //  握手设置心跳包时长
        heartbeatTimeout = heartbeatInterval * 2;        //  最长断连时间
    } else {
        heartbeatInterval = 0;
        heartbeatTimeout = 0;
    }

    initData(data);

    if(typeof handshakeCallback === 'function') {
        handshakeCallback(data.user);
    }
};

/**
 *  第一次握手数确认
 */
function handshake(data) {

    data = JSON.parse(Protocol.strdecode(data));
    if(data.code === RES_OLD_CLIENT) {
        //客户端版本不一样
        return;
    }

    if(data.code !== RES_OK) {
        //握手失败
        return;
    }

    handshakeInit(data);
    //客户端发送确认连接
    var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
    send(obj);
    if(initCallback) {
        initCallback(socket);
    }

};

/**
 * 发送心跳包
 */
function heartbeat(data) {

    if(!heartbeatInterval) {
        // no heartbeat
        return;
    }

    if(heartbeatTimeoutId) {
        clearTimeout(heartbeatTimeoutId);
        heartbeatTimeoutId = null;
    }

    if(heartbeatId) {
        // already in a heartbeat interval
        return;
    }

    heartbeatId = setTimeout(function() {
        heartbeatId = null;

        //发送心跳包
        var obj = Package.encode(Package.TYPE_HEARTBEAT);
        send(obj);

        nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
        heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout);

    }, heartbeatInterval);

};
/**
 * 服务器心跳包断连
 */
function heartbeatTimeoutCb() {
    var gap = nextHeartbeatTimeout - Date.now();

    if(gap > gapThreshold) {
        heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap);
    } else {
        disconnect();
    }

};

/**
 * 握手头数据  版本信息  Buffer压缩配置
 * @param data
 */
function initData(data) {
    if(!data || !data.sys) {
        return;
    }

    dict = data.sys.dict;
    var protos = data.sys.protos;

    if(dict) {
        dict = dict;
        for(var route in dict) {
            abbrs[dict[route]] = route;
        }
    }

    if(protos) {
        protoVersion = protos.version || 0;
        serverProtos = protos.server || {};
        clientProtos = protos.client || {};
    }

};

/**
 * 解压数据
 * @param data
 */
function onData(data) {

    var msg = data;
    if(decode) {
        msg = decode(msg);
    }
    processMessage(msg);

};
/**
 * 服务器踢下线
 * @param data
 */
function onKick(data) {
    reconnect=false;
    disconnect();
    EventEmitter.emit("onKick", JSON.parse(Protocol.strdecode(data)));
};

handlers[Package.TYPE_HANDSHAKE] = handshake;   //握手消息返回
handlers[Package.TYPE_HEARTBEAT] = heartbeat;   //心跳消息
handlers[Package.TYPE_DATA] = onData;           //数据消息
handlers[Package.TYPE_KICK] = onKick;           //踢下线

/**
 * 接收到数据后进行拆包
 */
function processPackage(msgs) {

    if(Array.isArray(msgs)) {
        for(var i=0; i<msgs.length; i++) {
            var msg = msgs[i];
            handlers[msg.type](msg.body);
        }
    } else {
        handlers[msgs.type](msgs.body);
    }
};

/**
 *  根据消息ID 获取 callbacks
 * @param msg
 */
function processMessage(msg) {

    if(!msg.id) {
        EventEmitter.emit(msg.route, msg.body);
        return;
    }

    var cb = callbacks[msg.id];
    delete callbacks[msg.id];

    if(typeof cb !== 'function') {
        return;
    }

    return cb(msg.body);

};


/**
 * 发送信息，拼接转码
 */
function sendMessage(reqId, route, msg) {

    if(encode) {
        msg = encode(reqId, route, msg);
    }
    var packet = Package.encode(Package.TYPE_DATA, msg);
    send(packet);

};

/**
 *  socket发送信息
 */
function send(packet) {
    if(socket) {
        socket.send(packet.buffer);
    }
};
/**
 * 转码
 */
function defaultEncode(reqId, route, msg) {

    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;

    msg = Protocol.strencode(JSON.stringify(msg));

    var compressRoute = 0;
    if(dict && dict[route]) {
        route = dict[route];
        compressRoute = 1;
    }

    return Message.encode(reqId, type, compressRoute, route, msg);
};

/**
 * 解码 Body
 */
var deCompose = function(msg) {
    return JSON.parse(Protocol.strdecode(msg.body));
};

/*
 * 解码 Data
 */
function defaultDecode(data) {
    var msg = Message.decode(data);
    if(msg.id > 0){
        msg.route = routeMap[msg.id];
        delete routeMap[msg.id];
        if(!msg.route){
            return;
        }
    }
    msg.body = deCompose(msg);
    return msg;
};


function disconnect () {

    if(socket) {
        if(socket.disconnect) socket.disconnect();
        if(socket.close) socket.close();
        console.log('disconnect');
        socket = null;
    }
    if(heartbeatId) {
        clearTimeout(heartbeatId);
        heartbeatId = null;
    }
    if(heartbeatTimeoutId) {
        clearTimeout(heartbeatTimeoutId);
        heartbeatTimeoutId = null;
    }

}

export default {

    on: function(evt, listener) {
        EventEmitter.on(evt, listener)
    },

    init: function (params, cb) {

        initCallback = cb;
        var host = params.host;
        var port = params.port;

        encode = params.encode || defaultEncode;
        decode = params.decode || defaultDecode;

        var url = 'ws://' + host;
        if(port) {
            url +=  ':' + port;
        }

        handshakeBuffer.user = params.user;
        if(params.encrypt) {
            useCrypto = true;
            rsa.generate(1024, "10001");
            var data = {
                rsa_n: rsa.n.toString(16),
                rsa_e: rsa.e
            }
            handshakeBuffer.sys.rsa = data;
        }
        handshakeCallback = params.handshakeCallback;
        connect(params, url, cb);

    },
    request: function (route, msg, cb) {

        if(arguments.length === 2 && typeof msg === 'function') {
            cb = msg;
            msg = {};
        } else {
            msg = msg || {};
        }
        route = route || msg.route;
        if(!route) {
            return;
        }
        reqId++;
        sendMessage(reqId, route, msg);
        routeMap[reqId] = route;
        callbacks[reqId] = cb;

    },
    disconnect: function () {
        disconnect();
    }
};
