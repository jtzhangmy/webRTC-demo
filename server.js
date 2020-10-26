const Koa = require('koa');
const app = new Koa();
const cors = require('koa2-cors');
const server = require('http').Server(app.callback());
const io = require('socket.io')(server);
const port = 3000;

app.use(cors());
app.use(require('koa-static')(__dirname));

server.listen(process.env.PORT || port, () => {
    console.log(`app run at : http://127.0.0.1:${port}`);
});

io.on('connection', socket => {
    console.log('初始化成功！下面可以用socket绑定事件和触发事件了');

    socket.on('msg', data => {
        console.log(111, data);
    });

    socket.on('broadcast', data => {
        console.log('广播：', data);
        socket.broadcast.emit('broadcast', data);
    });

    socket.on('join', data => {
        console.log('加入：', data)
        socket.broadcast.emit('joined', data);
    })
});
