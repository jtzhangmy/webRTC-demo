//主要流程 ，其他方式传输 Description 和 Candidate
//呼叫方  createDataChannel->createOffer->广播本身Description 和 Candidate ↓↓                  -->接收和设置对方传输Description 和 Candidate  -->OK
//接听方                                  接收对方传输Description 和 Candidate  -->createAnswer --> 获得和传输本身Description 和 Candidate ↑↑   -->OK
const RTCPeerConnection =
    window.PeerConnection ||
    window.webkitPeerConnection00 ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection;

const callBtn = document.getElementById("callBtn");
const sendBtn = document.getElementById("send-btn");
const hangBtn = document.getElementById("hangBtn");
const contentInput = document.getElementById("contentInput");

let pc;
let mediaConstraints = null;
let conf = null;
let channel;
let localDescription, localCandidate, remoteDescription, remoteCandidate;
let receiveBuffer = [];
let receivedSize = 0;
let fileInfo = {
    size: 0,
    name: ""
};

// 监听
const socket = io("http://10.129.20.203:3000");
socket.open();
socket.on("broadcast", msg => {
    const {
        data: {sdp, candidate}
    } = msg;
    switch (msg.type) {
        case "offer":
            tip("接收offer");
            remoteDescription = sdp;
            remoteCandidate = candidate;
            createAnswer();
            break;
        case "answer":
            tip("接收answer");
            remoteDescription = sdp;
            remoteCandidate = candidate;
            finishConnection();
            break;
        case "fileInfo":
            const {
                data: {name, size, filetype, lastmodify}
            } = msg;
            fileInfo = {
                fileSize: size,
                fileName: name
            };
            break;
        default:
            return;
    }
});

// 创建链接
pc = new RTCPeerConnection(conf, mediaConstraints);
// 接收p2p消息
pc.ondatachannel = e => {
    console.log("传输通道打开");
    channel = e.channel;
    channel.onopen = () => {
        tip("可以 发送/接收 消息");
        console.log("接收通道打开");
    };
    channel.onclose = () => {
        tip("关闭消息通道");
        console.log("接收通道关闭");
    };
    channel.onmessage = e => {
        console.log("接收通道信息");
        if (toString.call(e.data) === "[object ArrayBuffer]") {
            receiveFile(e);
        } else {
            receiveText("收到:" + e.data);
        }
    };
};

//
pc.onicecandidate = e => {
    console.log("on ice candidate", e);
    if (e.candidate) {
        //这里传输candidate给对方
        localCandidate = e.candidate;
        if (!remoteCandidate) {
            socket.emit("broadcast", {
                type: "offer",
                data: {
                    sdp: localDescription,
                    candidate: localCandidate
                }
            });
        }
        console.error("获取到ice: ", e.candidate);
    }
};
pc.onidentityresult = function () {
    console.log("on identity result");
};
pc.onidpassertionerror = function () {
    console.log("on id passertion error");
};
pc.onidpvalidationerror = function () {
    console.log("on id pvalidation error");
};
pc.onnegotiationneeded = createOffer;
pc.onpeeridentity = function () {
    console.log("on peeridentity");
};
pc.onremovestream = function () {
    console.log("on remove stream");
};
pc.onconnectionstatechange = function () {
    console.log("on connection state change: ", pc.connectionState);
};
pc.oniceconnectionstatechange = function () {
    console.log("on ice connection state change: ", pc.iceConnectionState);
};
pc.onsignalingstatechange = function () {
    console.log("on signaling state change: ", pc.signalingState);
};
pc.ontrack = function () {
    console.log("on track");
};

// 创建offer
function createOffer() {
    console.error(2, "创建offer", "on negotiation needed");
    pc.createOffer().then(offer => {
        console.error(3, "向远端广播offer", offer);
        localDescription = offer;
        //这里传输Description 给接听方 , 手动复制
        tip("创建offer");
        console.error(4, "设置本地offer");
        pc.setLocalDescription(offer);
    });
}

// 接收offer, 创建answer
function createAnswer() {
    // 1 设置远程description
    pc.setRemoteDescription(new RTCSessionDescription(remoteDescription));
    // 2 创建answer
    pc.createAnswer().then(function (answer) {
        console.error(5, "创建远程answer", answer);
        localDescription = answer;
        tip("创建answer");
        pc.setLocalDescription(answer);
        socket.emit("broadcast", {
            type: "answer",
            data: {
                sdp: localDescription
            }
        });
    });
    // 3 添加ico后补
    pc.addIceCandidate(remoteCandidate);
}

function finishConnection() {
    const sdp = new RTCSessionDescription(remoteDescription);
    pc.setRemoteDescription(sdp);
}

//1 请求呼叫
callBtn.onclick = function () {
    console.error(1, "创建dataChannel");
    channel = pc.createDataChannel("hehe", mediaConstraints); //可以发送文字什么的
    channel.onopen = function () {
        tip("可以 发送/接收 消息");
        console.log("hehe通道打开", channel);
    };
    channel.onclose = function () {
        tip("关闭消息通道");
        console.log("hehe通道关闭");
    };
    channel.onmessage = function (e) {
        console.log("hehe通道信息");
        receive("收到:" + e.data);
    };
};

// 发送
sendBtn.onclick = function () {
    channel.send(contentInput.value);
    send(contentInput.value);
    contentInput.value = "";
};

//关闭
hangBtn.onclick = function () {
    channel.close();
    pc.close();
};

/***
 *操作提示
 */
function tip(msg) {
    const d = document.createElement("div");
    d.className = "tip";
    d.innerHTML = msg;
    log.appendChild(d);
}

/***
 *操作提示
 */
function receiveText(msg) {
    const d = document.createElement("div");
    d.className = "receive-text";
    d.innerHTML = msg;
    log.appendChild(d);
}

function receiveImage(info) {
    const a = document.createElement("a");
    a.className = "receive-href";
    a.setAttribute("href", info.href);
    a.download = info.fileName;
    const img = document.createElement("img");
    img.className = "receive-img";
    img.setAttribute("src", info.href);
    a.appendChild(img);
    log.appendChild(a);
}

function send(msg) {
    const d = document.createElement("div");
    d.className = "send-text";
    d.innerHTML = msg;
    log.appendChild(d);
}

/*------ 下载 ------*/
const fileInput = document.getElementById("fileInput");
const fileBtn = document.getElementById("file-btn");
const sendProgress = document.getElementById("sendProgress");
const statusMessage = document.getElementById("status");

fileInput.addEventListener("change", handleFileInputChange);

function handleFileInputChange() {
    const file = fileInput.files[0];
    if (!file) {
        console.log("No file chosen");
    } else {
        sendData();

        sendProgress.value = 0;
        receiveProgress.value = 0;
        receiveBuffer = [];
        receivedSize = 0;
    }
}

fileBtn.onclick = () => fileInput.click();

function sendData() {
    let offset = 0;
    let chunkSize = 16384;
    let file = fileInput.files[0];
    const {name, size, type, lastModified} = file;
    console.error(`File is ${[name, size, type, lastModified].join(" ")}`);

    socket.emit("broadcast", {
        type: "fileInfo",
        data: {
            name,
            size,
            filetype: type,
            lastModified
        }
    });

    // Handle 0 size files.
    statusMessage.textContent = "";
    if (file.size === 0) {
        bitrateDiv.innerHTML = "";
        statusMessage.textContent = "File is empty, please select a non-empty file";
        return;
    }

    sendProgress.max = file.size;

    fileReader = new FileReader();
    fileReader.onerror = error => console.error("Error reading file:", error);
    fileReader.onabort = event => console.log("File reading aborted:", event);
    fileReader.onload = e => {
        console.log("FileRead.onload ", e);
        const {result} = e.target;
        channel.send(result);
        offset += result.byteLength;
        sendProgress.value = offset;
        if (offset < file.size) {
            readSlice(offset);
        }
    };

    const readSlice = o => {
        console.log("readSlice ", o);
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };

    readSlice(0);
}

function receiveFile(e) {
    console.error("接收文件");
    receiveBuffer.push(e.data);
    receivedSize += e.data.byteLength;
    receiveProgress.value = receivedSize;
    const {fileSize, fileName} = fileInfo;
    if (receivedSize === fileSize) {
        const received = new Blob(receiveBuffer);
        receiveBuffer = [];
        receiveImage({
            href: URL.createObjectURL(received),
            fileName
        });

        // downloadAnchor.href = URL.createObjectURL(received);
        // downloadAnchor.download = fileName;
        // downloadAnchor.textContent = `Click to download '${fileName}' (${fileSize} bytes)`;
        // downloadAnchor.style.display = "block";
    }
}
