// 兼容性
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

const RTCPeerConnection =
    window.PeerConnection ||
    window.webkitPeerConnection00 ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection;

const RTCSessionDescription =
    window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

var pc = null;
const localUserId = Math.random()
    .toString(36)
    .substr(2); // store local userId
const localVideo = document.getElementById('local');
const remoteVideo = document.getElementById('remote');

const MESSAGE_TYPE_OFFER = 1;
const MESSAGE_TYPE_ANSWER = 2;
const MESSAGE_TYPE_CANDIDATE = 3;
const MESSAGE_TYPE_HANGUP = 4;
var localStream;

// ice服务器
const stun = {
    urls: ['stun:stun.l.google.com:19302'],
};
const turn = {
    url: 'turn:141.164.57.228:3488',
    username: 'bk201',
    credential: 'aspirine',
};
const serverConfig = {
    iceServers: [stun, turn],
};

// socket
const socket = io('http://10.129.27.216:3000');
// 链接
socket.open();

socket.on('connect', () => {
    console.error('socket-id: ', socket.id); //
});

// 重连
socket.on('disconnect', () => {
    socket.open();
});
socket.on('broadcast', function(msg) {
    // console.error(999, '接收到广播: ', msg);
    if (localUserId == msg.userId) return;
    switch (msg.msgType) {
        // 处理远程offer
        case MESSAGE_TYPE_OFFER:
            handleRemoteOffer(msg);
            break;
        // 处理远程answer
        case MESSAGE_TYPE_ANSWER:
            handleRemoteAnswer(msg);
            break;
        // 处理远程后补
        case MESSAGE_TYPE_CANDIDATE:
            handleRemoteCandidate(msg);
            break;
        // 处理远程断开
        case MESSAGE_TYPE_HANGUP:
            handleRemoteHangup();
            break;
        default:
            break;
    }
});

/*------ 处理远程offer start ------*/
function handleRemoteOffer(msg) {
    console.error('广播 ', 1, '接收到offer: ', msg);
    if (pc == null) {
        createPeerConnection('remote');
    }
    const sdp = new RTCSessionDescription({
        type: 'offer',
        sdp: msg.sdp,
    });
    pc.setRemoteDescription(sdp);
    doAnswer();
}

// 回答
function doAnswer() {
    console.error('广播', 2, '应答呼叫: 向远程对等方发送应答');
    if (pc == null) createPeerConnection('answer');
    pc.createAnswer().then(createAnswerAndSendMessage, handleCreateAnswerError);
}

// 创建回答 and发送消息
function createAnswerAndSendMessage(sessionDescription) {
    console.error('广播', 3, '创建,设置本地answer: ', sessionDescription);
    pc.setLocalDescription(sessionDescription);
    const message = {
        userId: localUserId,
        msgType: MESSAGE_TYPE_ANSWER,
        sdp: sessionDescription.sdp,
    };
    socket.emit('broadcast', message);
    // console.error('广播回答:', message);
}

// 回答错误
function handleCreateAnswerError(error) {
    console.error('CreateAnswer() error: ', error);
}

/*------ 处理远程offer end ------*/

/*------ 处理远程answer start ------*/
function handleRemoteAnswer(msg) {
    console.error('广播', 'answer: ', msg);
    const sdp = new RTCSessionDescription({
        type: 'answer',
        sdp: msg.sdp,
    });
    pc.setRemoteDescription(sdp);
}

/*------ 处理远程answer end ------*/

/*------ 处理远程后补 start ------*/
function handleRemoteCandidate(msg) {
    console.error('广播', '接收到远程候选: ', msg.candidate);
    const candidate = new RTCIceCandidate({
        sdpMLineIndex: msg.label,
        candidate: msg.candidate,
    });
    pc.addIceCandidate(candidate);
}

/*------ 处理远程后补 end ------*/

/*------ 处理远程断开 start ------*/
function handleRemoteHangup() {
    console.error('Remote hangup received');
    hangup();
}

function hangup() {
    console.error('挂起 !');
    remoteVideo.srcObject = null;
    if (pc != null) {
        pc.close();
        pc = null;
    }
}

/*------ 处理远程断开 end ------*/

document.getElementById('start').onclick = function() {
    console.error(1, '开始');
    doCall();
};

function doCall() {
    console.error(2, '呼叫');
    if (pc == null) {
        createPeerConnection('call');
    }
    pc.createOffer(createOfferAndSendMessage, handleCreateOfferError);
}

// 创建offer成功
function createOfferAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    const message = {
        userId: localUserId,
        msgType: MESSAGE_TYPE_OFFER,
        sdp: sessionDescription.sdp,
    };
    socket.emit('broadcast', message);
    console.error(7, '创建offer，发送msg', sessionDescription);
}

// 创建offer失败
function handleCreateOfferError(event) {
    console.error('CreateOffer() error: ', event);
}

function createPeerConnection(type) {
    console.error(3, type, '创建链接');
    try {
        pc = new RTCPeerConnection(serverConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        pc.addStream(localStream);
        console.error(6, type, '链接创建完成');
    } catch (e) {
        console.error('创建失败' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    if (!event.candidate) return;
    console.error(4, '处理ICE候选事件: ', event.candidate.candidate);
    if (event.candidate) {
        const message = {
            userId: localUserId,
            msgType: MESSAGE_TYPE_CANDIDATE,
            id: event.candidate.sdpMid,
            label: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate,
        };
        socket.emit('broadcast', message);
        // console.error('广播 ip:', message);
    } else {
        console.error('End of candidates.');
    }
}

function handleRemoteStreamAdded(event) {
    console.error(5, '远程流添加');
    remoteVideo.srcObject = event.stream;
    remoteVideo.onloadedmetadata = e => remoteVideo.play();
}

function handleRemoteStreamRemoved(event) {
    console.error('Handle remote stream removed. Event: ', event);
    remoteVideo.srcObject = null;
}

// 视频
if (navigator.getUserMedia) {
    navigator.getUserMedia(
        { audio: false, video: { width: 640, height: 360 } },
        stream => {
            // 将流展示到
            openLocalStream(stream);
        },
        err => {
            console.log('The following error occurred: ' + err.name);
        },
    );
} else {
    console.error('getUserMedia not supported');
}

function openLocalStream(stream) {
    console.error('Open local video stream');
    localVideo.srcObject = stream;
    localStream = stream;
    localVideo.onloadedmetadata = e => localVideo.play();
}
